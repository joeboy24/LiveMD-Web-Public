"use server";

import { revalidatePath } from "next/cache";
import { denied } from "../../auth/access";
import { getSql } from "../../db";
import { readOrganization } from "./queries";

export type GroupState = { error: string | null };

const idPattern = /^[0-9a-f-]{36}$/i;

export async function createGroup(_state: GroupState, formData: FormData): Promise<GroupState> {
  const block = await denied("organize");
  if (block) return { error: block };
  const name = clean(formData.get("name"));
  if (!name) return { error: "Enter a group name." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  const sql = getSql();
  await sql`insert into groups (organization_id, name) values (${organization.id}, ${name})`;
  refresh();
  return { error: null };
}

export async function renameGroup(groupId: string, name: string) {
  const block = await denied("organize");
  if (block || !idPattern.test(groupId)) return;
  const next = clean(name);
  if (!next) return;
  const organization = await readOrganization();
  if (!organization) return;
  const sql = getSql();
  await sql`
    update groups
    set name = ${next}
    where id = ${groupId} and organization_id = ${organization.id}
  `;
  refresh();
}

export async function setGroupSeat(groupId: string, seatId: string, member: boolean) {
  const block = await denied("organize");
  if (block || !idPattern.test(groupId) || !idPattern.test(seatId)) return "That seat didn't update.";
  const organization = await readOrganization();
  const seat = organization?.seats.find((item) => item.id === seatId);
  if (!organization || !seat || (member && seat.disabled)) return "That seat is missing.";
  const sql = getSql();
  const groups = await sql`
    select id from groups where id = ${groupId} and organization_id = ${organization.id}
  `;
  if (!groups[0]) return "That group is missing.";
  if (member) {
    await sql`
      insert into group_seats (group_id, seat_id)
      values (${groupId}, ${seatId})
      on conflict (group_id, seat_id) do nothing
    `;
  } else {
    await sql`delete from group_seats where group_id = ${groupId} and seat_id = ${seatId}`;
  }
  refresh();
  return null;
}

export async function removeGroup(groupId: string) {
  const block = await denied("organize");
  if (block || !idPattern.test(groupId)) return;
  const organization = await readOrganization();
  if (!organization) return;
  const sql = getSql();
  const groups = await sql`
    select id from groups where id = ${groupId} and organization_id = ${organization.id}
  `;
  if (!groups[0]) return;
  await sql`
    update shows
    set audience_group_ids = coalesce(
          (
            select jsonb_agg(to_jsonb(item))
            from jsonb_array_elements_text(audience_group_ids) as item
            where item <> ${groupId}
          ),
          '[]'::jsonb
        ),
        audience_group_id = case when audience_group_id = ${groupId}::uuid then null else audience_group_id end,
        audience = case
          when audience = 'group' and audience_group_id = ${groupId}::uuid then 'everyone'
          else audience
        end
    where audience_group_ids @> ${JSON.stringify([groupId])}::jsonb
       or audience_group_id = ${groupId}::uuid
  `;
  await sql`delete from group_seats where group_id = ${groupId}`;
  await sql`delete from groups where id = ${groupId}`;
  refresh();
}

function clean(value: unknown) {
  return String(value ?? "").trim().slice(0, 60);
}

function refresh() {
  revalidatePath("/organization/groups");
  revalidatePath("/", "layout");
}
