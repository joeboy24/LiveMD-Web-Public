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
        select organizations.id, organizations.name, organizations.plan
        from seats
        join organizations on organizations.id = seats.organization_id
        where seats.account_id = ${account.id}
        order by seats.created_at asc
        limit 1
      `
    : await sql`
        select id, name, plan
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
