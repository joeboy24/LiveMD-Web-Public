"use server";

import { readSystemAdmin } from "../../admin/access";
import { readSessionAccount } from "../../auth/queries";
import { getSql } from "../../db";
import { ensureSystemNotices } from "./notify";
import { ensureSupportColumns, readOrganization, readSeatAudience } from "./queries";

export type Notice = {
  id: string;
  label: string;
  title: string;
  body: string;
  read: boolean;
  sentAt: string;
};

export type NoticeMark = "none" | "new" | "system";

export type NoticePage = {
  notices: Notice[];
  page: number;
  pages: number;
  mark: NoticeMark;
};

const pageSize = 5;
const empty: NoticePage = { notices: [], page: 0, pages: 1, mark: "none" };

export async function listNotifications(page = 0): Promise<NoticePage> {
  const scope = await scopeForSeat();
  const accountId = await supportAccount();
  if (!scope && !accountId) return empty;
  await ensureSystemNotices();
  const sql = getSql();
  const seatRows = scope
    ? await sql`
        select id, kind, title, body, read_at as "readAt", created_at as "sentAt"
        from notifications
        where organization_id = ${scope.organizationId}
          and seat_id = ${scope.seatId}
          and (kind <> 'system' or ${scope.seesAll})
        order by created_at desc
        limit 100
      `
    : [];
  const supportRows = accountId
    ? await sql`
        select id, title, body, read_at as "readAt", created_at as "sentAt"
        from system_notices
        where account_id = ${accountId}
        order by created_at desc
        limit 100
      `
    : [];
  const notices = [
    ...seatRows.map((row) => noticeFrom(row, String(row.kind))),
    ...supportRows.map((row) => noticeFrom(row, "support")),
  ].sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  const unreadSystem = notices.filter((notice) => !notice.read && (notice.label === "System" || notice.label === "Support")).length;
  const unreadFresh = notices.filter((notice) => !notice.read && notice.label !== "System" && notice.label !== "Support").length;
  const pages = Math.max(1, Math.ceil(notices.length / pageSize));
  const current = Math.min(Math.max(0, Math.floor(page)), pages - 1);
  return {
    page: current,
    pages,
    mark: noticeMark(unreadSystem, unreadFresh),
    notices: notices.slice(current * pageSize, current * pageSize + pageSize),
  };
}

export async function supportPulse(): Promise<{ open: string; title: string; body: string }> {
  const account = await readSessionAccount();
  if (!account || !(await readSystemAdmin())) return { open: "", title: "", body: "" };
  await ensureSupportColumns();
  const sql = getSql();
  const email = account.email.toLowerCase();
  const rows = await sql`
    select messages.id, messages.subject, messages.body, messages.sender_name as "senderName",
      organizations.name as organization
    from messages
    join organizations on organizations.id = messages.organization_id
    where messages.group_name = 'Support'
      and not exists (
        select 1 from support_replies where support_replies.message_id = messages.id
      )
      and lower(coalesce(messages.sender_email, '')) <> ${email}
    order by messages.created_at desc
  `;
  const newest = rows[0];
  const open = rows
    .map((row) => (row.id ? String(row.id) : ""))
    .filter(Boolean)
    .sort()
    .join(",");
  const sender = newest?.senderName ? String(newest.senderName) : "Seat";
  const organization = newest?.organization ? String(newest.organization) : "";
  const text = newest?.body ? String(newest.body) : "";
  return {
    open,
    title: newest?.subject ? String(newest.subject) : "",
    body: newest ? `${sender}${organization ? ` · ${organization}` : ""}\n${text}` : "",
  };
}

export async function unreadNotifications(): Promise<NoticeMark> {
  const page = await listNotifications(0);
  return page.mark;
}

export async function openNotification(id: string): Promise<NoticeMark> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return "none";
  const scope = await scopeForSeat();
  const accountId = await supportAccount();
  if (!scope && !accountId) return "none";
  await ensureSystemNotices();
  const sql = getSql();
  if (scope) {
    await sql`
      update notifications
      set read_at = coalesce(read_at, now())
      where id = ${id}
        and organization_id = ${scope.organizationId}
        and seat_id = ${scope.seatId}
        and (kind <> 'system' or ${scope.seesAll})
    `;
  }
  if (accountId) {
    await sql`
      update system_notices
      set read_at = coalesce(read_at, now())
      where id = ${id} and account_id = ${accountId}
    `;
  }
  return unreadNotifications();
}

async function supportAccount() {
  const account = await readSessionAccount();
  if (!account || !(await readSystemAdmin())) return null;
  return account.id;
}

async function scopeForSeat() {
  const audience = await readSeatAudience();
  const organization = await readOrganization();
  if (!audience || !organization) return null;
  return { organizationId: organization.id, seatId: audience.seatId, seesAll: audience.seesAll };
}

function noticeMark(system: number, fresh: number): NoticeMark {
  if (system > 0) return "system";
  if (fresh > 0) return "new";
  return "none";
}

function noticeFrom(row: Record<string, unknown>, kind: string): Notice {
  const sentAt = row.sentAt instanceof Date ? row.sentAt.toISOString() : String(row.sentAt ?? "");
  return {
    id: String(row.id),
    label: labelFor(kind),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    read: row.readAt != null,
    sentAt,
  };
}

function labelFor(kind: string) {
  if (kind === "support") return "Support";
  if (kind === "system") return "System";
  if (kind === "show") return "Show";
  return "Message";
}
