import { createHash, randomBytes } from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { getSql } from "../db";

const cookieName = "livemd_session";
const linkMinutes = 15;
const sessionDays = 30;

export type SessionAccount = {
  id: string;
  email: string;
  name: string | null;
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
  await sql`alter table seats add column if not exists accepted_at timestamptz`;
  await sql`alter table seats add column if not exists account_id uuid references accounts (id)`;
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const readSessionAccount = cache(async (): Promise<SessionAccount | null> => {
  await ensureAuthTables();
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || token.length > 128) return null;
  const sql = getSql();
  const rows = await sql`
    select accounts.id, accounts.email, accounts.name
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
  };
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

  await sql`
    update seats
    set account_id = ${accountId},
        accepted_at = case
          when invited_at is not null then coalesce(accepted_at, now())
          else accepted_at
        end
    where lower(email) = ${email}
  `;
  return accountId;
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
