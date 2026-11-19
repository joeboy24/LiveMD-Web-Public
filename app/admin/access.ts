import { cache } from "react";
import { readSessionAccount } from "../auth/queries";
import { getSql } from "../db";

let ready: Promise<void> | null = null;

function ensureAdminTable() {
  ready ??= createAdminTable().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function createAdminTable() {
  const sql = getSql();
  await sql.query(
    `create table if not exists system_admins (
      account_id uuid primary key references accounts (id),
      created_at timestamptz not null default now()
    )`,
  );
}

export const readSystemAdmin = cache(async () => {
  await ensureAdminTable();
  const account = await readSessionAccount();
  if (!account) return false;
  const sql = getSql();
  const rows = await sql`
    select
      exists(select 1 from system_admins where account_id = ${account.id}) as mine,
      (select count(*) from system_admins) as total,
      (
        select seats.account_id
        from seats
        join organizations on organizations.id = seats.organization_id
        where seats.role = 'Owner' and seats.account_id is not null
        order by organizations.created_at asc
        limit 1
      ) as first_owner
  `;
  const row = rows[0];
  if (row?.mine === true || String(row?.mine) === "t" || String(row?.mine) === "true") return true;
  if (Number(row?.total) > 0 || String(row?.first_owner ?? "") !== account.id) return false;
  await sql`
    insert into system_admins (account_id)
    select ${account.id}
    where not exists (select 1 from system_admins)
  `;
  return true;
});
