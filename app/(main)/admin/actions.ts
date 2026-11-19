"use server";

import { revalidatePath } from "next/cache";
import { readSystemAdmin } from "../../admin/access";
import { getSql } from "../../db";
import { readPlanPrices, writeCustomSeats } from "../organization/billing";

export type PriceState = { error: string | null; saved: boolean; stamp: string };

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
