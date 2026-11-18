"use server";

import { getSql } from "../../db";
import { readOrganization, readSeatAudience } from "./queries";

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
  if (!scope) return empty;
  const sql = getSql();
  const counts = await sql`
    select count(*)::int as total,
      (count(*) filter (where read_at is null and kind = 'system'))::int as system,
      (count(*) filter (where read_at is null and kind <> 'system'))::int as fresh
    from notifications
    where organization_id = ${scope.organizationId}
      and seat_id = ${scope.seatId}
      and (kind <> 'system' or ${scope.seesAll})
  `;
  const total = Number(counts[0]?.total ?? 0);
  const mark = noticeMark(Number(counts[0]?.system ?? 0), Number(counts[0]?.fresh ?? 0));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(0, Math.floor(page)), pages - 1);
  const rows = await sql`
    select id, kind, title, body, read_at as "readAt", created_at as "sentAt"
    from notifications
    where organization_id = ${scope.organizationId}
      and seat_id = ${scope.seatId}
      and (kind <> 'system' or ${scope.seesAll})
    order by created_at desc
    limit ${pageSize} offset ${current * pageSize}
  `;
  return {
    page: current,
    pages,
    mark,
    notices: rows.map((row) => ({
      id: String(row.id),
      label: labelFor(String(row.kind)),
      title: String(row.title),
      body: String(row.body ?? ""),
      read: row.readAt != null,
      sentAt: row.sentAt instanceof Date ? row.sentAt.toISOString() : String(row.sentAt),
    })),
  };
}

export async function unreadNotifications(): Promise<NoticeMark> {
  const page = await listNotifications(0);
  return page.mark;
}

export async function openNotification(id: string): Promise<NoticeMark> {
  const scope = await scopeForSeat();
  if (!scope || !/^[0-9a-f-]{36}$/i.test(id)) return "none";
  const sql = getSql();
  await sql`
    update notifications
    set read_at = coalesce(read_at, now())
    where id = ${id}
      and organization_id = ${scope.organizationId}
      and seat_id = ${scope.seatId}
      and (kind <> 'system' or ${scope.seesAll})
  `;
  return unreadNotifications();
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

function labelFor(kind: string) {
  if (kind === "system") return "System";
  if (kind === "show") return "Show";
  return "Message";
}
