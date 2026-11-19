import { cache } from "react";
import { ensureAuthTables, readSessionAccount } from "../../auth/queries";
import { getSql } from "../../db";

export type SeatRecord = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  invited: boolean;
  accountId: string | null;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  plan: string;
  planUntil: string | null;
  trialUntil: string | null;
  seats: SeatRecord[];
};

let ready: Promise<void> | null = null;

export function ensureOrganizationTables() {
  ready ??= migrate().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function migrate() {
  const sql = getSql();
  await sql`
    create table if not exists organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      plan text not null default 'Personal',
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table organizations add column if not exists plan text not null default 'Personal'`;
  await sql`alter table organizations add column if not exists plan_until timestamptz`;
  await sql`alter table organizations add column if not exists trial_until timestamptz`;
  await sql`
    update organizations
    set trial_until = now() + interval '14 days'
    where plan = 'Personal' and plan_until is null and trial_until is null
  `;
  await sql`
    create table if not exists seats (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations (id),
      name text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    alter table shows
    add column if not exists organization_id uuid references organizations (id)
  `;
  await sql`alter table seats add column if not exists email text`;
  await sql`alter table seats add column if not exists role text`;
  await sql`alter table seats add column if not exists invited_at timestamptz`;
  await sql`update seats set role = 'Owner' where role is null`;
  try {
    await sql`
      create unique index if not exists seats_organization_email
      on seats (organization_id, lower(email))
      where email is not null
    `;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "23505") throw error;
  }
  await sql`
    create table if not exists todos (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations (id),
      body text not null,
      done boolean not null default false,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists groups (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations (id),
      name text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists group_seats (
      group_id uuid not null references groups (id),
      seat_id uuid not null references seats (id),
      primary key (group_id, seat_id)
    )
  `;
  await sql`
    create table if not exists messages (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations (id),
      group_name text not null,
      subject text not null,
      body text not null default '',
      recipients jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table messages add column if not exists body text not null default ''`;
  await sql`
    create table if not exists notifications (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations (id),
      seat_id uuid not null references seats (id),
      kind text not null,
      title text not null,
      body text not null default '',
      read_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists notifications_seat_created
    on notifications (seat_id, created_at desc)
  `;
  await sql`alter table shows add column if not exists audience text not null default 'everyone'`;
  await sql`alter table shows add column if not exists audience_role text`;
  await sql`alter table shows add column if not exists audience_group_id uuid`;
  await sql`alter table shows add column if not exists audience_roles jsonb not null default '[]'::jsonb`;
  await sql`alter table shows add column if not exists audience_group_ids jsonb not null default '[]'::jsonb`;
  await sql`
    update shows
    set audience_roles = jsonb_build_array(audience_role)
    where audience = 'role' and audience_role is not null and audience_roles = '[]'::jsonb
  `;
  await sql`
    update shows
    set audience_group_ids = jsonb_build_array(audience_group_id)
    where audience = 'group' and audience_group_id is not null and audience_group_ids = '[]'::jsonb
  `;
  await ensureAuthTables();
}

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

export async function listTodos(): Promise<TodoItem[]> {
  const organization = await readOrganization();
  if (!organization) return [];
  const sql = getSql();
  const rows = await sql`
    select id, body, done
    from todos
    where organization_id = ${organization.id}
    order by created_at asc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    text: String(row.body),
    done: row.done === true,
  }));
}

export async function organizationId() {
  const organization = await readOrganization();
  return organization?.id ?? null;
}

export const readOrganization = cache(async (): Promise<OrganizationRecord | null> => {
  await ensureOrganizationTables();
  const account = await readSessionAccount();
  const sql = getSql();
  const rows = account
    ? await sql`
        select organizations.id, organizations.name, organizations.plan, organizations.plan_until as "planUntil", organizations.trial_until as "trialUntil"
        from seats
        join organizations on organizations.id = seats.organization_id
        where seats.account_id = ${account.id}
        order by seats.created_at asc
        limit 1
      `
    : await sql`
        select id, name, plan, plan_until as "planUntil", trial_until as "trialUntil"
        from organizations
        order by created_at asc
        limit 1
      `;
  const row = rows[0];
  if (!row) return null;
  const id = String(row.id);
  const seats = await sql`
    select id, name, email, role, invited_at, accepted_at, account_id
    from seats
    where organization_id = ${id}
    order by created_at asc
  `;
  return {
    id,
    name: String(row.name),
    plan: String(row.plan ?? "Personal"),
    planUntil: row.planUntil ? new Date(String(row.planUntil)).toISOString() : null,
    trialUntil: row.trialUntil ? new Date(String(row.trialUntil)).toISOString() : null,
    seats: seats.map((seat) => ({
      id: String(seat.id),
      name: String(seat.name),
      email: seat.email ? String(seat.email) : null,
      role: String(seat.role ?? "Owner"),
      invited: seat.invited_at != null && seat.accepted_at == null,
      accountId: seat.account_id ? String(seat.account_id) : null,
    })),
  };
});

export type SeatAudience = {
  role: string;
  seatId: string;
  seesAll: boolean;
  groupIds: string[];
};

export const readSeatAudience = cache(async (): Promise<SeatAudience | null> => {
  const account = await readSessionAccount();
  const organization = await readOrganization();
  if (!account || !organization) return null;
  const seat = organization.seats.find((item) => item.accountId === account.id);
  if (!seat) return null;
  const seesAll = seat.role === "Owner" || seat.role === "Music director";
  if (seesAll) return { role: seat.role, seatId: seat.id, seesAll, groupIds: [] };
  const sql = getSql();
  const rows = await sql`select group_id from group_seats where seat_id = ${seat.id}`;
  return {
    role: seat.role,
    seatId: seat.id,
    seesAll,
    groupIds: rows.map((row) => String(row.group_id)),
  };
});

export type SeatGroup = {
  id: string;
  name: string;
  seatIds: string[];
};

export async function listGroups(): Promise<SeatGroup[]> {
  const organization = await readOrganization();
  if (!organization) return [];
  const sql = getSql();
  const groups = await sql`
    select id, name
    from groups
    where organization_id = ${organization.id}
    order by created_at asc
  `;
  const members = await sql`
    select group_id as "groupId", seat_id as "seatId"
    from group_seats
    where group_id in (select id from groups where organization_id = ${organization.id})
  `;
  const byGroup = new Map<string, string[]>();
  for (const row of members) {
    const id = String(row.groupId);
    const seats = byGroup.get(id) ?? [];
    seats.push(String(row.seatId));
    byGroup.set(id, seats);
  }
  return groups.map((group) => ({
    id: String(group.id),
    name: String(group.name),
    seatIds: byGroup.get(String(group.id)) ?? [],
  }));
}
