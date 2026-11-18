"use server";

import { denied } from "../../auth/access";
import { messageLetter } from "../../auth/letter";
import { mailConfigured, sendMail } from "../../auth/mail";
import { getSql } from "../../db";
import { notifySeats } from "./notify";
import { readOrganization } from "./queries";

export type MessageState = { error: string | null; sent: number; stamp: string };

export type SentMessage = {
  id: string;
  subject: string;
  body: string;
  group: string;
  recipients: string[];
  sentAt: string;
};

export type SentPage = {
  messages: SentMessage[];
  page: number;
  pages: number;
};

export type MailSeat = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

const pageSize = 5;
const idPattern = /^[0-9a-f-]{36}$/i;

export async function listMessageSeats(): Promise<MailSeat[]> {
  const organization = await readOrganization();
  if (!organization) return [];
  return organization.seats.map((seat) => ({
    id: seat.id,
    name: seat.name,
    email: seat.email,
    role: seat.role,
  }));
}

export async function listSentMessages(page = 0): Promise<SentPage> {
  const organization = await readOrganization();
  if (!organization) return { messages: [], page: 0, pages: 1 };
  const sql = getSql();
  const counts = await sql`select count(*)::int as total from messages where organization_id = ${organization.id}`;
  const total = Number(counts[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(0, Math.floor(page)), pages - 1);
  const rows = await sql`
    select id, subject, body, group_name as "group", recipients, created_at as "sentAt"
    from messages
    where organization_id = ${organization.id}
    order by created_at desc
    limit ${pageSize} offset ${current * pageSize}
  `;
  return {
    page: current,
    pages,
    messages: rows.map((row) => ({
      id: String(row.id),
      subject: String(row.subject),
      body: String(row.body ?? ""),
      group: String(row.group),
      recipients: nameList(row.recipients),
      sentAt: row.sentAt instanceof Date ? row.sentAt.toISOString() : String(row.sentAt),
    })),
  };
}

export async function sendGroupMessage(_state: MessageState, formData: FormData): Promise<MessageState> {
  const block = await denied("organize");
  if (block) return { error: block, sent: 0, stamp: "" };
  if (!mailConfigured()) return { error: "Mail is not connected.", sent: 0, stamp: "" };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first.", sent: 0, stamp: "" };
  const subject = clip(formData.get("subject"), 120);
  const body = clip(formData.get("body"), 2000);
  if (!subject || !body) return { error: "Add a subject and a message.", sent: 0, stamp: "" };
  const chosen = new Set(formData.getAll("seat").map(String).filter((id) => idPattern.test(id)));
  if (chosen.size === 0) return { error: "Choose at least one seat.", sent: 0, stamp: "" };
  const targets = organization.seats.filter((seat) => chosen.has(seat.id) && seat.email);
  if (targets.length === 0) return { error: "Choose a seat that has an email.", sent: 0, stamp: "" };
  const label = clip(formData.get("label"), 60) || "Seats";
  const letter = messageLetter(organization.name, label, subject, body);
  const sql = getSql();
  const delivered: { id: string; name: string }[] = [];
  for (const seat of targets) {
    const result = await sendMail(String(seat.email), letter.subject, letter.text, letter.html);
    if (!result.error) delivered.push({ id: seat.id, name: String(seat.name) });
  }
  if (delivered.length === 0) return { error: "The email could not be sent.", sent: 0, stamp: "" };
  await sql`
    insert into messages (organization_id, group_name, subject, body, recipients)
    values (${organization.id}, ${label}, ${subject}, ${body}, ${JSON.stringify(delivered.map((seat) => seat.name))}::jsonb)
  `;
  await notifySeats(
    delivered.map((seat) => ({
      organizationId: organization.id,
      seatId: seat.id,
      kind: "note" as const,
      title: subject,
      body,
    })),
  );
  return { error: null, sent: delivered.length, stamp: crypto.randomUUID() };
}

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function nameList(value: unknown) {
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
