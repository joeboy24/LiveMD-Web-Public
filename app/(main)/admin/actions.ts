"use server";

import { revalidatePath } from "next/cache";
import { accountIsClosed, readAccountRole, readSystemPages, readSystemRole } from "../../admin/access";
import { pagesFrom, type SystemPage } from "../../admin/pages";
import { hashPassword } from "../../auth/password";
import { createPasswordAccount, findAccountByEmail, readSessionAccount } from "../../auth/queries";
import { getSql } from "../../db";
import { deleteDiscount, readDiscounts, readPlanPrices, writeCustomSeats, writeDiscount, type DiscountKind } from "../organization/billing";

export type PriceState = { error: string | null; saved: boolean; stamp: string };

export type SystemUserState = { error: string | null; saved: boolean; stamp: string };

export type DiscountState = { error: string | null; saved: boolean; stamp: string; code: string };

const plans = ["Personal", "House", "Room"] as const;

export async function savePlanPrice(_state: PriceState, formData: FormData): Promise<PriceState> {
  if (!(await holds("prices"))) return { error: "The system holds these prices.", saved: false, stamp: "" };
  const plan = String(formData.get("plan") ?? "");
  if (!plans.includes(plan as (typeof plans)[number])) return { error: "That plan is missing.", saved: false, stamp: "" };
  const limits = limitsFrom(formData.get("seats"), formData.get("storage"));
  if (limits.error || limits.seats == null || limits.storage == null) return { error: limits.error, saved: false, stamp: "" };
  const quarter = centsFrom(String(formData.get("quarter") ?? ""));
  const year = centsFrom(String(formData.get("year") ?? ""));
  if (String(formData.get("quarter") ?? "").trim() && quarter == null) return { error: "Enter the 3-month price in dollars.", saved: false, stamp: "" };
  if (String(formData.get("year") ?? "").trim() && year == null) return { error: "Enter the 1-year price in dollars.", saved: false, stamp: "" };
  if ((quarter != null && quarter < 50) || (year != null && year < 50)) return { error: "The smallest charge is 50 cents.", saved: false, stamp: "" };
  if (quarter == null && year == null) return { error: "Enter a price for 3 months or 1 year.", saved: false, stamp: "" };

  await readPlanPrices();
  const sql = getSql();
  await sql`
    insert into plan_prices (plan, quarter_cents, year_cents, seats, storage_gb, currency)
    values (${plan}, ${quarter}, ${year}, ${limits.seats}, ${limits.storage}, 'usd')
    on conflict (plan) do update
    set quarter_cents = excluded.quarter_cents,
        year_cents = excluded.year_cents,
        seats = excluded.seats,
        storage_gb = excluded.storage_gb,
        currency = 'usd'
  `;
  revalidatePath("/admin");
  revalidatePath("/organization/plan");
  return { error: null, saved: true, stamp: crypto.randomUUID() };
}

function limitsFrom(seatsValue: FormDataEntryValue | null, storageValue: FormDataEntryValue | null) {
  const seats = wholeFrom(String(seatsValue ?? ""));
  const storage = wholeFrom(String(storageValue ?? ""));
  if (seats == null) return { error: "Enter the seats.", seats: null, storage: null };
  if (storage == null) return { error: "Enter the storage in GB.", seats: null, storage: null };
  return { error: "", seats, storage };
}

function wholeFrom(raw: string) {
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 1 || value > 100000) return null;
  return value;
}

function centsFrom(raw: string) {
  const value = raw.trim().replace(/^\$/, "").replaceAll(",", "");
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isInteger(cents) || cents < 1) return null;
  return cents;
}

export async function saveDiscount(_state: DiscountState, formData: FormData): Promise<DiscountState> {
  const denied = { error: "The system holds these prices.", saved: false, stamp: "", code: "" };
  if (!(await holds("discounts"))) return denied;
  const raw = String(formData.get("code") ?? "").trim();
  const typed = codeFrom(raw);
  if (raw && !typed) return { error: "Use up to 7 letters and numbers.", saved: false, stamp: "", code: "" };
  const kind = kindFrom(formData.get("kind"));
  if (!kind) return { error: "Choose a percent or a price.", saved: false, stamp: "", code: "" };
  const off = offFrom(kind, String(formData.get("off") ?? ""));
  if (off.error) return { error: off.error, saved: false, stamp: "", code: "" };

  const code = typed ?? (await unusedCode());
  if (!code) return { error: "Generate the code again.", saved: false, stamp: "", code: "" };
  const saved = await writeDiscount({ code, kind, percent: off.percent, amountCents: off.amountCents });
  if (!saved) return { error: "That code is already in use.", saved: false, stamp: "", code: "" };
  return { error: null, saved: true, stamp: crypto.randomUUID(), code };
}

export async function removeDiscount(raw: string) {
  if (!(await holds("discounts"))) return { error: "The system holds these prices.", saved: false };
  const code = codeFrom(raw);
  if (!code) return { error: "That code is missing.", saved: false };
  await deleteDiscount(code);
  return { error: null, saved: true };
}

function kindFrom(value: FormDataEntryValue | null): DiscountKind | null {
  return value === "percent" || value === "amount" ? value : null;
}

function codeFrom(raw: string) {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,7}$/.test(code)) return null;
  return code;
}

function offFrom(kind: DiscountKind, raw: string) {
  if (kind === "percent") {
    const percent = Number(raw.trim());
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) return { error: "Enter a percent from 1 to 100.", percent: null, amountCents: null };
    return { error: null, percent, amountCents: null };
  }
  const amountCents = centsFrom(raw);
  if (amountCents == null) return { error: "Enter the price off in dollars.", percent: null, amountCents: null };
  if (amountCents < 50) return { error: "The smallest amount off is 50 cents.", percent: null, amountCents: null };
  return { error: null, percent: null, amountCents };
}

async function unusedCode() {
  const taken = new Set((await readDiscounts()).map((item) => item.code));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generatedCode();
    if (!taken.has(code)) return code;
  }
  return null;
}

function generatedCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function saveCustomSeats(raw: string) {
  if (!(await holds("prices"))) return { error: "The system holds these prices.", saved: false };
  const seats = seatsFrom(raw);
  if (seats == null) return { error: "Custom should be more than 100.", saved: false };
  await writeCustomSeats(seats);
  return { error: null, saved: true };
}

export async function createSystemUser(_state: SystemUserState, formData: FormData): Promise<SystemUserState> {
  if (!(await holds("users"))) return { error: "The system holds these accounts.", saved: false, stamp: "" };
  const name = cleanName(formData.get("name"));
  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "").slice(0, 128);
  const role = formData.get("role") === "admin" ? "admin" : "user";
  const pages = role === "admin" ? [] : pagesFrom(formData.getAll("page"));
  if (!name) return { error: "Enter a name.", saved: false, stamp: "" };
  if (!email) return { error: "Enter an email.", saved: false, stamp: "" };
  if (password.length < 8) return { error: "Use at least 8 characters.", saved: false, stamp: "" };
  if (role === "admin" && (await readSystemRole()) !== "admin") return { error: "An admin adds another admin.", saved: false, stamp: "" };
  if (role === "user" && pages.length === 0) return { error: "Choose a page.", saved: false, stamp: "" };
  const sql = getSql();
  const seated = await sql`select id from seats where lower(email) = ${email} limit 1`;
  if (seated.length > 0) return { error: "That email already has a seat.", saved: false, stamp: "" };
  if (await findAccountByEmail(email)) return { error: "That email already has an account.", saved: false, stamp: "" };
  const accountId = await createPasswordAccount(email, name, await hashPassword(password));
  if (role === "admin") {
    await sql.query(`insert into system_admins (account_id, role) values ($1, 'admin') on conflict (account_id) do nothing`, [accountId]);
  } else {
    await sql.query(
      `insert into system_admins (account_id, permissions, role) values ($1, $2::text[], 'user') on conflict (account_id) do nothing`,
      [accountId, textArray(pages)],
    );
  }
  revalidatePath("/admin/users");
  return { error: null, saved: true, stamp: crypto.randomUUID() };
}

export async function updateSystemUser(accountId: string, rawPages: string[]) {
  if (!(await holds("users"))) return { error: "The system holds these accounts.", saved: false };
  const current = await readSessionAccount();
  if (!current || current.id === accountId) return { error: "Keep your own pages.", saved: false };
  if (await accountIsClosed(accountId)) return { error: "That account is deleted.", saved: false };
  if ((await readAccountRole(accountId)) === "admin") return { error: "An admin keeps every page.", saved: false };
  const sql = getSql();
  const seated = await sql`select id from seats where account_id = ${accountId} limit 1`;
  if (seated.length > 0) return { error: "That account holds a seat.", saved: false };
  const pages = pagesFrom(rawPages);
  await sql.query(`update system_admins set permissions = $2::text[] where account_id = $1`, [accountId, textArray(pages)]);
  revalidatePath("/admin/users");
  return { error: null, saved: true };
}

export async function removeSystemUser(accountId: string) {
  if (!(await holds("users"))) return { error: "The system holds these accounts.", saved: false };
  const current = await readSessionAccount();
  if (!current || current.id === accountId) return { error: "Keep your own system access.", saved: false };
  const sql = getSql();
  if (await accountIsClosed(accountId)) return { error: "That account is already deleted.", saved: false };
  if ((await readAccountRole(accountId)) === "admin" && (await readSystemRole()) !== "admin") return { error: "A user cannot delete an admin.", saved: false };
  const seated = await sql`select id from seats where account_id = ${accountId} limit 1`;
  if (seated.length > 0) return { error: "That account holds a seat.", saved: false };
  await sql`update sessions set expires_at = now() where account_id = ${accountId} and expires_at > now()`;
  await sql.query(`update system_admins set deleted_at = now(), permissions = '{}'::text[] where account_id = $1 and deleted_at is null`, [accountId]);
  revalidatePath("/admin/users");
  return { error: null, saved: true };
}

async function holds(page: SystemPage) {
  return (await readSystemPages()).includes(page);
}

function textArray(pages: SystemPage[]) {
  return `{${pages.join(",")}}`;
}

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

function seatsFrom(raw: string) {
  const seats = Number(raw.trim());
  if (!Number.isInteger(seats) || seats < 101) return null;
  return seats;
}
