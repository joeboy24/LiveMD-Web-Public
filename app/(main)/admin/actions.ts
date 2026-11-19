"use server";

import { revalidatePath } from "next/cache";
import { readSystemAdmin } from "../../admin/access";
import { getSql } from "../../db";
import { deleteDiscount, readDiscounts, readPlanPrices, writeCustomSeats, writeDiscount, type DiscountKind } from "../organization/billing";

export type PriceState = { error: string | null; saved: boolean; stamp: string };

export type DiscountState = { error: string | null; saved: boolean; stamp: string; code: string };

const plans = ["House", "Room"] as const;

export async function savePlanPrice(_state: PriceState, formData: FormData): Promise<PriceState> {
  if (!(await readSystemAdmin())) return { error: "The system holds these prices.", saved: false, stamp: "" };
  const plan = String(formData.get("plan") ?? "");
  if (!plans.includes(plan as (typeof plans)[number])) return { error: "That plan is missing.", saved: false, stamp: "" };
  const quarter = centsFrom(String(formData.get("quarter") ?? ""));
  const year = centsFrom(String(formData.get("year") ?? ""));
  if (String(formData.get("quarter") ?? "").trim() && quarter == null) return { error: "Enter the 3-month price in dollars.", saved: false, stamp: "" };
  if (String(formData.get("year") ?? "").trim() && year == null) return { error: "Enter the 1-year price in dollars.", saved: false, stamp: "" };
  if ((quarter != null && quarter < 50) || (year != null && year < 50)) return { error: "The smallest charge is 50 cents.", saved: false, stamp: "" };
  if (quarter == null && year == null) return { error: "Enter a price for 3 months or 1 year.", saved: false, stamp: "" };

  await readPlanPrices();
  const sql = getSql();
  await sql`
    insert into plan_prices (plan, quarter_cents, year_cents, currency)
    values (${plan}, ${quarter}, ${year}, 'usd')
    on conflict (plan) do update
    set quarter_cents = excluded.quarter_cents,
        year_cents = excluded.year_cents,
        currency = 'usd'
  `;
  revalidatePath("/admin");
  revalidatePath("/organization/plan");
  return { error: null, saved: true, stamp: crypto.randomUUID() };
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
  if (!(await readSystemAdmin())) return denied;
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
  if (!(await readSystemAdmin())) return { error: "The system holds these prices.", saved: false };
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
  if (!(await readSystemAdmin())) return { error: "The system holds these prices.", saved: false };
  const seats = seatsFrom(raw);
  if (seats == null) return { error: "Custom should be more than 100.", saved: false };
  await writeCustomSeats(seats);
  return { error: null, saved: true };
}

function seatsFrom(raw: string) {
  const seats = Number(raw.trim());
  if (!Number.isInteger(seats) || seats < 101) return null;
  return seats;
}
