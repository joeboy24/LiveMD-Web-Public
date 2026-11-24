import { cache } from "react";
import { readSessionAccount } from "../auth/queries";
import { getSql } from "../db";
import { pageList, systemPages, type SystemPage } from "./pages";

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
  await sql.query(`alter table system_admins add column if not exists permissions text[]`);
  await sql.query(`alter table system_admins add column if not exists deleted_at timestamptz`);
  await sql.query(`alter table system_admins add column if not exists role text`);
  await sql.query(`alter table system_admins add column if not exists support_mail boolean not null default false`);
  await sql.query(`
    update system_admins
    set role = 'admin'
    where role is null
      and exists (select 1 from seats where seats.account_id = system_admins.account_id)
  `);
  await sql.query(`update system_admins set role = 'user' where role is null`);
}

export const readSystemAdmin = cache(async () => {
  await ensureAdminTable();
  const account = await readSessionAccount();
  if (!account) return false;
  const sql = getSql();
  const rows = await sql`
    select
      exists(select 1 from system_admins where account_id = ${account.id} and deleted_at is null) as mine,
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
    insert into system_admins (account_id, role)
    select ${account.id}, 'admin'
    where not exists (select 1 from system_admins)
  `;
  return true;
});

export type SystemRole = "admin" | "user";

export type SystemUser = {
  id: string;
  name: string;
  email: string;
  seated: boolean;
  deleted: boolean;
  role: SystemRole;
  pages: SystemPage[];
  supportMail: boolean;
};

const everyPage = systemPages.map((page) => page.key);

function truthy(value: unknown) {
  return value === true || value === "t" || value === "true";
}

export async function readOwnSupportMail() {
  if (!(await readSystemAdmin())) return null;
  const account = await readSessionAccount();
  if (!account) return null;
  const sql = getSql();
  const rows = await sql`
    select support_mail as "supportMail"
    from system_admins
    where account_id = ${account.id} and deleted_at is null
    limit 1
  `;
  if (!rows[0]) return null;
  return truthy(rows[0].supportMail);
}

export async function accountIsClosed(accountId: string) {
  await ensureAdminTable();
  const sql = getSql();
  const rows = await sql`
    select 1 from system_admins
    where account_id = ${accountId} and deleted_at is not null
    limit 1
  `;
  return rows.length > 0;
}

export async function accountIsSystemOnly(accountId: string) {
  await ensureAdminTable();
  const sql = getSql();
  const rows = await sql`
    select
      exists(select 1 from system_admins where account_id = ${accountId} and deleted_at is null) as admin,
      exists(select 1 from seats where account_id = ${accountId}) as seated
  `;
  const row = rows[0];
  return truthy(row?.admin) && !truthy(row?.seated);
}

export async function readAccountPages(accountId: string): Promise<SystemPage[]> {
  await ensureAdminTable();
  const sql = getSql();
  const rows = await sql`
    select system_admins.permissions, system_admins.role, system_admins.deleted_at as "deletedAt"
    from system_admins
    where system_admins.account_id = ${accountId}
  `;
  const row = rows[0];
  if (!row || row.deletedAt) return [];
  if (row.role === "admin") return everyPage;
  return pageList(row.permissions) ?? [];
}

export async function readAccountRole(accountId: string): Promise<SystemRole | null> {
  await ensureAdminTable();
  const sql = getSql();
  const rows = await sql`
    select role from system_admins
    where account_id = ${accountId} and deleted_at is null
  `;
  const role = rows[0]?.role;
  return role === "admin" || role === "user" ? role : null;
}

export const readSystemRole = cache(async () => {
  const account = await readSessionAccount();
  if (!account) return null;
  return readAccountRole(account.id);
});

export const readSystemPages = cache(async () => {
  const account = await readSessionAccount();
  if (!account) return [];
  return readAccountPages(account.id);
});

export async function readSystemUsers(): Promise<SystemUser[]> {
  await ensureAdminTable();
  const sql = getSql();
  const rows = await sql`
    select accounts.id, accounts.name, accounts.email, system_admins.permissions, system_admins.role,
      system_admins.support_mail as "supportMail", system_admins.deleted_at as "deletedAt",
      exists(select 1 from seats where seats.account_id = accounts.id) as seated
    from system_admins
    join accounts on accounts.id = system_admins.account_id
    order by system_admins.deleted_at asc nulls first, system_admins.created_at asc
  `;
  return rows.flatMap((row) => {
    const id = row.id ? String(row.id) : "";
    const email = row.email ? String(row.email) : "";
    if (!id || !email) return [];
    const seated = truthy(row.seated);
    const deleted = Boolean(row.deletedAt);
    const role: SystemRole = row.role === "admin" ? "admin" : "user";
    const pages = deleted ? [] : role === "admin" ? everyPage : (pageList(row.permissions) ?? []);
    return [{ id, name: row.name ? String(row.name) : email, email, seated, deleted, role, pages, supportMail: truthy(row.supportMail) }];
  });
}
