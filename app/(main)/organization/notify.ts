import { messageLetter } from "../../auth/letter";
import { sendMail } from "../../auth/mail";
import { getSql } from "../../db";

export type NoticeKind = "note" | "show" | "system";

type NoticeRow = {
  organizationId: string;
  seatId: string;
  kind: NoticeKind;
  title: string;
  body: string;
};

let ready: Promise<void> | null = null;

export function ensureNotifications() {
  ready ??= createTable().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function createTable() {
  const sql = getSql();
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
}

let noticesReady: Promise<void> | null = null;

export function ensureSystemNotices() {
  noticesReady ??= ensureNotifications()
    .then(async () => {
      const sql = getSql();
      await sql`
        create table if not exists system_notices (
          id uuid primary key default gen_random_uuid(),
          account_id uuid not null references accounts (id),
          title text not null,
          body text not null default '',
          read_at timestamptz,
          created_at timestamptz not null default now()
        )
      `;
      await sql`
        create index if not exists system_notices_account_created
        on system_notices (account_id, created_at desc)
      `;
    })
    .catch((error: unknown) => {
      noticesReady = null;
      throw error;
    });
  return noticesReady;
}

export async function notifySupportStaff(input: {
  title: string;
  body: string;
  organization: string;
  message: string;
  from: string;
  exceptAccountId?: string;
}): Promise<string[]> {
  await ensureSystemNotices();
  const sql = getSql();
  await sql`alter table system_admins add column if not exists support_mail boolean not null default false`;
  const staff = await sql`
    select system_admins.account_id as id, system_admins.support_mail as "supportMail", accounts.name, accounts.email
    from system_admins
    join accounts on accounts.id = system_admins.account_id
    where system_admins.deleted_at is null
  `;
  const letter = messageLetter(input.organization, "Support", input.title, input.message, input.from);
  const mailed: string[] = [];
  for (const row of staff) {
    const accountId = String(row.id);
    if (accountId === input.exceptAccountId) continue;
    await sql`
      insert into system_notices (account_id, title, body)
      values (${accountId}, ${clip(input.title, 120)}, ${clip(input.body, 2000)})
    `;
    const email = row.email ? String(row.email) : "";
    const flag = row.supportMail;
    const wantsMail = flag === true || flag === "t" || flag === "true" || flag === 1;
    if (!wantsMail || !email) continue;
    const result = await sendMail(email, letter.subject, letter.text, letter.html);
    if (!result.error) mailed.push(row.name ? String(row.name) : email);
  }
  return mailed;
}

export async function notifySeats(rows: NoticeRow[]) {
  if (rows.length === 0) return;
  await ensureNotifications();
  const sql = getSql();
  for (const row of rows) {
    await sql`
      insert into notifications (organization_id, seat_id, kind, title, body)
      values (${row.organizationId}, ${row.seatId}, ${row.kind}, ${clip(row.title, 120)}, ${clip(row.body, 2000)})
    `;
  }
}

export async function notifyLeaders(organizationId: string, title: string, body: string, exceptSeatId?: string) {
  await ensureNotifications();
  const sql = getSql();
  const seats = await sql`
    select id
    from seats
    where organization_id = ${organizationId}
      and role in ('Owner', 'Music director')
  `;
  await notifySeats(
    seats
      .map((seat) => String(seat.id))
      .filter((id) => id !== exceptSeatId)
      .map((seatId) => ({
        organizationId,
        seatId,
        kind: "system" as const,
        title,
        body,
      })),
  );
}

export async function notifyPublishedShow(showId: string, fallbackOrganizationId: string) {
  await ensureNotifications();
  const sql = getSql();
  const shows = await sql`
    select title, performed_on::text as "performedOn", organization_id as "organizationId",
      audience, audience_role as "audienceRole", audience_group_id as "audienceGroupId",
      audience_roles as "audienceRoles", audience_group_ids as "audienceGroupIds"
    from shows
    where id = ${showId}
  `;
  const show = shows[0];
  const organizationId = show?.organizationId ? String(show.organizationId) : fallbackOrganizationId;
  if (!show || !organizationId) return;
  const roles = textList(show.audienceRoles);
  const groups = textList(show.audienceGroupIds);
  if (roles.length === 0 && show.audience === "role" && show.audienceRole) roles.push(String(show.audienceRole));
  if (groups.length === 0 && show.audience === "group" && show.audienceGroupId) groups.push(String(show.audienceGroupId));
  const open = roles.length === 0 && groups.length === 0;
  const seats = await sql`
    select id, role
    from seats
    where organization_id = ${organizationId}
  `;
  const links = await sql`
    select seat_id as "seatId", group_id as "groupId"
    from group_seats
    where seat_id in (select id from seats where organization_id = ${organizationId})
  `;
  const groupsBySeat = new Map<string, string[]>();
  for (const link of links) {
    const seatId = String(link.seatId);
    const current = groupsBySeat.get(seatId) ?? [];
    current.push(String(link.groupId));
    groupsBySeat.set(seatId, current);
  }
  const date = performedLabel(String(show.performedOn ?? ""));
  const body = date ? `Ready on the player for ${date}.` : "Ready on the player.";
  await notifySeats(
    seats
      .filter((seat) => seatCanOpen(String(seat.role ?? ""), groupsBySeat.get(String(seat.id)) ?? [], roles, groups, open))
      .map((seat) => ({
        organizationId,
        seatId: String(seat.id),
        kind: "show" as const,
        title: String(show.title),
        body,
      })),
  );
}

function seatCanOpen(role: string, seatGroups: string[], roles: string[], groups: string[], open: boolean) {
  if (role === "Playback operator") return false;
  if (role === "Owner" || role === "Music director") return true;
  if (open) return true;
  if (roles.includes(role)) return true;
  return groups.some((id) => seatGroups.includes(id));
}

function textList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

function performedLabel(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}
