"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { denied } from "../../auth/access";
import { appOrigin, mailConfigured, sendInvitation } from "../../auth/mail";
import { createSignInLink, dropSignInLink, readSessionAccount } from "../../auth/queries";
import { getSql } from "../../db";
import { readOrganization } from "./queries";
import { livePlan, readSeatAllowance } from "./billing";
import { roles } from "./sample";

export type OrganizationState = {
  error: string | null;
  sent?: boolean;
  saved?: boolean;
};

export async function createOrganization(_state: OrganizationState, formData: FormData): Promise<OrganizationState> {
  const block = await denied("organize");
  if (block) return { error: block };
  const name = cleanName(formData.get("name"));
  const seat = cleanName(formData.get("seat"));
  if (!name) return { error: "Enter an organization name." };
  if (!seat) return { error: "Enter your name." };
  const existing = await readOrganization();
  if (existing) return { error: null };

  const sql = getSql();
  const rows = await sql`
    insert into organizations (name)
    values (${name})
    returning id
  `;
  const id = String(rows[0].id);
  const account = await readSessionAccount();
  if (account) {
    await sql`
      insert into seats (organization_id, name, email, role, account_id)
      values (${id}, ${seat}, ${account.email}, 'Owner', ${account.id})
    `;
  } else {
    await sql`
      insert into seats (organization_id, name, role)
      values (${id}, ${seat}, 'Owner')
    `;
  }
  await sql`
    update shows
    set organization_id = ${id}
    where organization_id is null
  `;
  revalidatePath("/", "layout");
  return { error: null };
}

export async function renameOrganization(_state: OrganizationState, formData: FormData): Promise<OrganizationState> {
  const block = await denied("organize");
  if (block) return { error: block };
  const name = cleanName(formData.get("name"));
  if (!name) return { error: "Enter an organization name." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  const sql = getSql();
  await sql`update organizations set name = ${name} where id = ${organization.id}`;
  revalidatePath("/", "layout");
  return { error: null };
}

export async function addSeat(_state: OrganizationState, formData: FormData): Promise<OrganizationState> {
  const block = await denied("organize");
  if (block) return { error: block };
  const name = cleanName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  const role = cleanRole(formData.get("role"));
  if (!name) return { error: "Enter a name." };
  if (!email) return { error: "Enter an email." };
  if (!role) return { error: "Choose a role." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  if (organization.seats.some((seat) => seat.email === email)) return { error: "That email already has a seat." };
  if (organization.seats.length >= seatLimit(organization.plan)) redirect("/organization/plan");
  const sql = getSql();
  await sql`
    insert into seats (organization_id, name, email, role, invited_at)
    values (${organization.id}, ${name}, ${email}, ${role}, now())
  `;
  revalidatePath("/", "layout");
  const mailed = await emailSeat(email, organization.name, role);
  return { error: mailed.error, sent: mailed.sent, saved: true };
}

export async function renameSeat(seatId: string, _state: OrganizationState, formData: FormData): Promise<OrganizationState> {
  const block = await denied("organize");
  if (block) return { error: block };
  const name = cleanName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  const role = cleanRole(formData.get("role"));
  if (!name) return { error: "Enter a name." };
  if (!role) return { error: "Choose a role." };
  if (!isId(seatId)) return { error: "That seat is missing." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  const seat = organization.seats.find((item) => item.id === seatId);
  if (!seat) return { error: "That seat is missing." };
  if (seat.invited && !email) return { error: "Enter an email." };
  if (email && organization.seats.some((item) => item.id !== seatId && item.email === email)) {
    return { error: "That email already has a seat." };
  }
  const sql = getSql();
  const rows = await sql`
    update seats
    set name = ${name}, email = ${email || null}, role = ${role}
    where id = ${seatId} and organization_id = ${organization.id}
    returning id
  `;
  if (!rows[0]) return { error: "That seat is missing." };
  revalidatePath("/", "layout");
  return { error: null };
}

export async function reinviteSeat(seatId: string): Promise<OrganizationState> {
  const block = await denied("organize");
  if (block) return { error: block };
  if (!isId(seatId)) return { error: "That seat is missing." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  const seat = organization.seats.find((item) => item.id === seatId);
  if (!seat || !seat.invited || !seat.email) return { error: "That seat is already accepted." };
  const sql = getSql();
  const rows = await sql`
    update seats
    set invited_at = now()
    where id = ${seatId} and organization_id = ${organization.id} and invited_at is not null
    returning id
  `;
  if (!rows[0]) return { error: "That seat is missing." };
  revalidatePath("/", "layout");
  if (!seat.email) return { error: "Enter an email." };
  const mailed = await emailSeat(seat.email, organization.name, seat.role);
  return { error: mailed.error, sent: mailed.sent };
}

export async function removeSeat(seatId: string): Promise<OrganizationState> {
  const block = await denied("organize");
  if (block) return { error: block };
  if (!isId(seatId)) return { error: "That seat is missing." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  if (organization.seats.length < 2) return { error: "An organization keeps one seat." };
  const sql = getSql();
  const rows = await sql`
    delete from seats
    where id = ${seatId} and organization_id = ${organization.id}
    returning id
  `;
  if (!rows[0]) return { error: "That seat is missing." };
  revalidatePath("/", "layout");
  return { error: null };
}

const roleNames = new Set<string>(roles.map((role) => role.name));

function cleanName(value: FormDataEntryValue | null) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return "";
  return name;
}

function cleanEmail(value: FormDataEntryValue | null) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function cleanRole(value: FormDataEntryValue | null) {
  const role = String(value ?? "").trim();
  return roleNames.has(role) ? role : "";
}

async function emailSeat(email: string, orgName: string, role: string) {
  if (!mailConfigured()) return { error: null, sent: false };
  const token = await createSignInLink(email);
  const url = `${await appOrigin()}/sign-in/verify?token=${encodeURIComponent(token)}`;
  const sent = await sendInvitation(email, orgName, role, url);
  if (sent.error) {
    await dropSignInLink(token);
    return { error: "The email could not be sent.", sent: false };
  }
  return { error: null, sent: true };
}

function isId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
