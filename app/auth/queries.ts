import { createHash, randomBytes } from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { sessionCookieName } from "./cookie";
import { getSql } from "../db";
import { notifyLeaders } from "../(main)/organization/notify";

const cookieName = sessionCookieName;
const linkMinutes = 15;
const sessionDays = 30;

export type SessionAccount = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
};

export const sessionCookie = {
  name: cookieName,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDays * 24 * 60 * 60,
  },
};

let ready: Promise<void> | null = null;

export function ensureAuthTables() {
  ready ??= migrate().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function migrate() {
  const sql = getSql();
  await sql`
    create table if not exists accounts (
      id uuid primary key default gen_random_uuid(),
      email text not null,
      name text,
      created_at timestamptz not null default now()
    )
  `;
  try {
    await sql`
      create unique index if not exists accounts_email
      on accounts (lower(email))
    `;
  } catch (error) {
    if (!duplicateRelation(error)) throw error;
  }
  await sql`
    create table if not exists sessions (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references accounts (id),
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists sign_in_links (
      id uuid primary key default gen_random_uuid(),
      email text not null,
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists account_visits (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references accounts (id),
      started_at timestamptz not null default now()
    )
  `;
  await sql`alter table accounts add column if not exists password_hash text`;
  await sql`alter table accounts add column if not exists phone text`;
  await sql`
    create table if not exists passkeys (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references accounts (id),
      credential_id text not null unique,
      public_key text not null,
      sign_count bigint not null default 0,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists passkey_challenges (
      id uuid primary key default gen_random_uuid(),
      account_id uuid references accounts (id),
      challenge text not null,
      kind text not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table seats add column if not exists accepted_at timestamptz`;
  await sql`alter table seats add column if not exists account_id uuid references accounts (id)`;
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function readAccountByToken(token: string): Promise<SessionAccount | null> {
  await ensureAuthTables();
  if (!token || token.length > 128) return null;
  const sql = getSql();
  const rows = await sql`
    select accounts.id, accounts.email, accounts.name, accounts.phone
    from sessions
    join accounts on accounts.id = sessions.account_id
    where sessions.token_hash = ${hashToken(token)}
      and sessions.expires_at > now()
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    phone: row.phone ? String(row.phone) : null,
  };
}

export const readSessionAccount = cache(async (): Promise<SessionAccount | null> => {
  const token = (await cookies()).get(cookieName)?.value ?? "";
  return readAccountByToken(token);
});

export async function createSignInLink(email: string) {
  await ensureAuthTables();
  const token = newToken();
  const expires = new Date(Date.now() + linkMinutes * 60 * 1000).toISOString();
  const sql = getSql();
  await sql`delete from sign_in_links where lower(email) = ${email}`;
  await sql`
    insert into sign_in_links (email, token_hash, expires_at)
    values (${email}, ${hashToken(token)}, ${expires})
  `;
  return token;
}

export async function dropSignInLink(token: string) {
  const sql = getSql();
  await sql`delete from sign_in_links where token_hash = ${hashToken(token)}`;
}

export async function consumeSignInLink(token: string) {
  if (!token || token.length > 128) return null;
  await ensureAuthTables();
  const sql = getSql();
  const links = await sql`
    delete from sign_in_links
    where token_hash = ${hashToken(token)}
      and expires_at > now()
    returning email
  `;
  const email = links[0]?.email ? String(links[0].email).toLowerCase() : "";
  if (!email) return null;

  const seats = await sql`
    select name
    from seats
    where lower(email) = ${email}
    order by created_at asc
    limit 1
  `;
  const seatName = seats[0]?.name ? String(seats[0].name) : null;
  const existing = await sql`
    select id, name
    from accounts
    where lower(email) = ${email}
    limit 1
  `;
  let accountId = existing[0] ? String(existing[0].id) : "";
  if (!accountId) {
    const created = await sql`
      insert into accounts (email, name)
      values (${email}, ${seatName})
      returning id
    `;
    accountId = String(created[0].id);
  } else if (!existing[0].name && seatName) {
    await sql`update accounts set name = ${seatName} where id = ${accountId}`;
  }

  await attachSeats(email, accountId);
  return accountId;
}

export async function findAccountByEmail(email: string) {
  await ensureAuthTables();
  const sql = getSql();
  const rows = await sql`
    select id, email, name, password_hash
    from accounts
    where lower(email) = ${email}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    passwordHash: row.password_hash ? String(row.password_hash) : null,
  };
}

export async function createOpenAccount(email: string, name: string) {
  await ensureAuthTables();
  const sql = getSql();
  const created = await sql`
    insert into accounts (email, name)
    values (${email}, ${name})
    returning id
  `;
  const accountId = String(created[0].id);
  await attachSeats(email, accountId);
  return accountId;
}

export async function createPasswordAccount(email: string, name: string, passwordHash: string, phone: string | null = null) {
  await ensureAuthTables();
  const sql = getSql();
  const created = await sql`
    insert into accounts (email, name, phone, password_hash)
    values (${email}, ${name}, ${phone}, ${passwordHash})
    returning id
  `;
  const accountId = String(created[0].id);
  await attachSeats(email, accountId);
  return accountId;
}

export async function readAccountSecret(accountId: string) {
  await ensureAuthTables();
  const sql = getSql();
  const rows = await sql`
    select password_hash
    from accounts
    where id = ${accountId}
    limit 1
  `;
  return rows[0]?.password_hash ? String(rows[0].password_hash) : null;
}

export async function saveAccountPhone(accountId: string, phone: string | null) {
  await ensureAuthTables();
  const sql = getSql();
  await sql`update accounts set phone = ${phone} where id = ${accountId}`;
}

export async function saveAccountName(accountId: string, name: string) {
  await ensureAuthTables();
  const sql = getSql();
  await sql`update accounts set name = ${name} where id = ${accountId}`;
  await sql`update seats set name = ${name} where account_id = ${accountId}`;
}

export async function saveAccountEmail(accountId: string, email: string) {
  await ensureAuthTables();
  const sql = getSql();
  const taken = await sql`
    select id from accounts
    where lower(email) = ${email} and id <> ${accountId}
    limit 1
  `;
  if (taken[0]) return false;
  const seatTaken = await sql`
    select id from seats
    where lower(email) = ${email}
      and account_id is distinct from ${accountId}
    limit 1
  `;
  if (seatTaken[0]) return false;
  try {
    await sql`update accounts set email = ${email} where id = ${accountId}`;
    await sql`update seats set email = ${email} where account_id = ${accountId}`;
  } catch (error) {
    if (duplicateRelation(error)) return false;
    throw error;
  }
  return true;
}

export async function replaceAccountPassword(accountId: string, passwordHash: string) {
  await ensureAuthTables();
  const sql = getSql();
  await sql`update accounts set password_hash = ${passwordHash} where id = ${accountId}`;
}

export async function setAccountPassword(accountId: string, name: string, passwordHash: string) {
  await ensureAuthTables();
  const sql = getSql();
  await sql`
    update accounts
    set password_hash = ${passwordHash},
        name = coalesce(name, ${name})
    where id = ${accountId}
  `;
}

export async function attachSeats(email: string, accountId: string) {
  const sql = getSql();
  const rows = await sql`
    update seats
    set account_id = ${accountId},
        accepted_at = case
          when invited_at is not null then coalesce(accepted_at, now())
          else accepted_at
        end
    where lower(email) = ${email}
    returning id, organization_id as "organizationId", name,
      (invited_at is not null and accepted_at = now()) as joined
  `;
  for (const row of rows) {
    if (row.joined !== true || !row.organizationId) continue;
    try {
      await notifyLeaders(
        String(row.organizationId),
        `${String(row.name)} joined`,
        `${String(row.name)} accepted the invitation.`,
        String(row.id),
      );
    } catch {
      // The seat is already attached. A missed alert can wait for the next visit.
    }
  }
}

export async function openSession(accountId: string) {
  await ensureAuthTables();
  const token = newToken();
  const expires = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000).toISOString();
  const sql = getSql();
  await sql`
    insert into sessions (account_id, token_hash, expires_at)
    values (${accountId}, ${hashToken(token)}, ${expires})
  `;
  return token;
}

export async function closeSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && token.length <= 128) {
    await ensureAuthTables();
    const sql = getSql();
    await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  }
  jar.delete(cookieName);
}

function duplicateRelation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && String(error.code) === "23505");
}
