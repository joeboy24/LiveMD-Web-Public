"use server";

import { revalidatePath } from "next/cache";
import { readSystemPages } from "../../admin/access";
import { messageLetter } from "../../auth/letter";
import { mailConfigured, sendMail } from "../../auth/mail";
import { readSessionAccount } from "../../auth/queries";
import { getSql } from "../../db";
import { notifySeats } from "../organization/notify";
import { ensureOrganizationTables, ensureSupportColumns } from "../organization/queries";

export type ReplyState = { error: string | null; saved: boolean; stamp: string };

const idPattern = /^[0-9a-f-]{36}$/i;

export async function supportStamp(): Promise<string> {
  if (!(await readSystemPages()).includes("support")) return "";
  await ensureOrganizationTables();
  await ensureSupportColumns();
  const sql = getSql();
  const [messages, replies] = await Promise.all([
    sql`select id from messages where group_name = 'Support' order by created_at desc limit 40`,
    sql`select id from support_replies order by created_at desc limit 40`,
  ]);
  return `${messages.map((row) => String(row.id)).join(",")}|${replies.map((row) => String(row.id)).join(",")}`;
}

export async function replyToSupport(_state: ReplyState, formData: FormData): Promise<ReplyState> {
  if (!(await readSystemPages()).includes("support")) return { error: "Support holds these messages.", saved: false, stamp: "" };
  if (!mailConfigured()) return { error: "Mail is not connected.", saved: false, stamp: "" };
  const messageId = String(formData.get("message") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (!idPattern.test(messageId)) return { error: "That message is missing.", saved: false, stamp: "" };
  if (!body) return { error: "Write a reply.", saved: false, stamp: "" };
  await ensureOrganizationTables();
  await ensureSupportColumns();
  const sql = getSql();
  const rows = await sql`
    select messages.subject, messages.sender_email as "senderEmail", messages.organization_id as "organizationId",
      organizations.name as organization
    from messages
    join organizations on organizations.id = messages.organization_id
    where messages.id = ${messageId} and messages.group_name = 'Support'
    limit 1
  `;
  const ticket = rows[0];
  if (!ticket) return { error: "That message is missing.", saved: false, stamp: "" };
  const organizationId = String(ticket.organizationId);
  const owners = await sql`
    select id, email
    from seats
    where organization_id = ${organizationId} and role = 'Owner' and email is not null
    order by created_at asc
    limit 1
  `;
  const senderEmail = ticket.senderEmail ? String(ticket.senderEmail) : "";
  const email = senderEmail || (owners[0]?.email ? String(owners[0].email) : "");
  if (!email) return { error: "This message has no email to answer.", saved: false, stamp: "" };
  const account = await readSessionAccount();
  const author = account?.name || "Support";
  const subject = `Re: ${String(ticket.subject ?? "Support")}`.slice(0, 140);
  const letter = messageLetter(String(ticket.organization ?? "Live MD"), "Support", subject, body);
  const mailed = await sendMail(email, letter.subject, letter.text, letter.html);
  if (mailed.error) return { error: mailed.error, saved: false, stamp: "" };
  await sql`
    insert into support_replies (message_id, body, author_name)
    values (${messageId}, ${body}, ${author})
  `;
  const seats = await sql`
    select id from seats
    where organization_id = ${organizationId} and lower(email) = ${email.toLowerCase()}
  `;
  if (seats.length > 0) {
    await notifySeats(
      seats.map((seat) => ({
        organizationId,
        seatId: String(seat.id),
        kind: "system" as const,
        title: subject,
        body,
      })),
    );
  }
  revalidatePath("/admin/support");
  return { error: null, saved: true, stamp: crypto.randomUUID() };
}
