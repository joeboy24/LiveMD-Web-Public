import { readSystemPages } from "./access";
import { getSql } from "../db";
import { ensureOrganizationTables, ensureSupportColumns } from "../(main)/organization/queries";

export type SupportReply = {
  id: string;
  body: string;
  author: string;
  sentAt: string;
};

export type SupportTicket = {
  id: string;
  organization: string;
  subject: string;
  body: string;
  senderName: string;
  replyTo: string;
  sentAt: string;
  replies: SupportReply[];
};

function when(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const text = value ? String(value) : "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function readSupportTickets(): Promise<SupportTicket[]> {
  if (!(await readSystemPages()).includes("support")) return [];
  await ensureOrganizationTables();
  await ensureSupportColumns();
  const sql = getSql();
  const [messages, replies, owners] = await Promise.all([
    sql`
      select messages.id, messages.subject, messages.body, messages.sender_name as "senderName",
        messages.sender_email as "senderEmail", messages.organization_id as "organizationId",
        messages.created_at as "sentAt", organizations.name as organization
      from messages
      join organizations on organizations.id = messages.organization_id
      where messages.group_name = 'Support'
      order by messages.created_at desc
    `,
    sql`
      select id, message_id as "messageId", body, author_name as author, created_at as "sentAt"
      from support_replies
      order by created_at asc
    `,
    sql`
      select distinct on (organization_id) organization_id as "organizationId", email
      from seats
      where role = 'Owner' and email is not null
      order by organization_id, created_at asc
    `,
  ]);
  const ownerEmail = new Map<string, string>();
  for (const row of owners) {
    const id = row.organizationId ? String(row.organizationId) : "";
    const email = row.email ? String(row.email) : "";
    if (id && email) ownerEmail.set(id, email);
  }
  const repliesByMessage = new Map<string, SupportReply[]>();
  for (const row of replies) {
    const messageId = row.messageId ? String(row.messageId) : "";
    const sentAt = when(row.sentAt);
    if (!messageId || !sentAt) continue;
    const list = repliesByMessage.get(messageId) ?? [];
    list.push({
      id: String(row.id),
      body: row.body ? String(row.body) : "",
      author: row.author ? String(row.author) : "Support",
      sentAt,
    });
    repliesByMessage.set(messageId, list);
  }
  return messages.flatMap((row) => {
    const id = row.id ? String(row.id) : "";
    const sentAt = when(row.sentAt);
    if (!id || !sentAt) return [];
    const senderEmail = row.senderEmail ? String(row.senderEmail) : "";
    const organizationId = row.organizationId ? String(row.organizationId) : "";
    return [{
      id,
      organization: row.organization ? String(row.organization) : "Organization",
      subject: row.subject ? String(row.subject) : "Support",
      body: row.body ? String(row.body) : "",
      senderName: row.senderName ? String(row.senderName) : "Seat",
      replyTo: senderEmail || ownerEmail.get(organizationId) || "",
      sentAt,
      replies: repliesByMessage.get(id) ?? [],
    }];
  });
}
