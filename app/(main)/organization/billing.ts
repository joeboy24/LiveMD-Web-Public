import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { getSql } from "../../db";
import { customPriceCents, plans, seatLimit, storageGb } from "./sample";

const paidPlans = ["House", "Room", "Custom"] as const;

export type PaidPlan = (typeof paidPlans)[number];

export function paymentsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export type PlanTerm = "quarter" | "year";

export type PlanPrice = {
  plan: string;
  quarterCents: number | null;
  yearCents: number | null;
  seats: number | null;
  currency: string;
};

export function livePlan(plan: string, planUntil: string | null) {
  if (!planUntil || new Date(planUntil).getTime() > Date.now()) return plan;
  return "Personal";
}

export async function readSeatAllowance(plan: string) {
  if (plan !== "Custom") return seatLimit(plan);
  const price = await readPlanPrice("Custom");
  return price?.seats && price.seats > 100 ? price.seats : 101;
}

export function storageBytes(plan: string) {
  const gb = storageGb(plan);
  return gb == null ? null : gb * 1000 * 1000 * 1000;
}

let pricesReady: Promise<void> | null = null;

function ensurePlanPrices() {
  pricesReady ??= preparePlanPrices().catch((error: unknown) => {
    pricesReady = null;
    throw error;
  });
  return pricesReady;
}

async function preparePlanPrices() {
  const sql = getSql();
  await sql.query(
    `create table if not exists plan_prices (
      plan text primary key,
      amount_cents integer,
      quarter_cents integer,
      year_cents integer,
      seats integer,
      currency text not null default 'usd'
    )`,
  );
  await sql.query(`alter table plan_prices drop column if exists stripe_price_id`);
  await sql.query(`alter table plan_prices add column if not exists quarter_cents integer`);
  await sql.query(`alter table plan_prices add column if not exists year_cents integer`);
  await sql.query(`alter table plan_prices add column if not exists seats integer`);
  await sql.query(`alter table plan_prices alter column amount_cents drop not null`);
}

export async function readPlanPrices() {
  await ensurePlanPrices();
  const sql = getSql();
  const rows = await sql`select plan, quarter_cents, year_cents, seats, currency from plan_prices`;
  return rows.flatMap((row) => {
    const plan = row.plan ? String(row.plan) : "";
    const quarterCents = centsOrNull(row.quarter_cents);
    const yearCents = centsOrNull(row.year_cents);
    const seats = Number(row.seats);
    const currency = row.currency ? String(row.currency) : "usd";
    if (!plan) return [];
    return [{ plan, quarterCents, yearCents, seats: Number.isInteger(seats) && seats > 100 ? seats : null, currency }];
  });
}

function centsOrNull(value: unknown) {
  const cents = Number(value);
  return Number.isInteger(cents) && cents >= 50 ? cents : null;
}

export function planCharge(prices: PlanPrice[], plan: string) {
  const row = prices.find((item) => item.plan === plan) ?? null;
  if (plan !== "Custom") return row;
  const room = prices.find((item) => item.plan === "Room");
  if (!row && !room) return null;
  const seats = row?.seats ?? 0;
  return {
    plan: "Custom",
    quarterCents: customPriceCents(room?.quarterCents ?? null, seats),
    yearCents: customPriceCents(room?.yearCents ?? null, seats),
    seats: row?.seats ?? null,
    currency: room?.currency ?? "usd",
  };
}

export async function readPlanPrice(plan: string) {
  return planCharge(await readPlanPrices(), plan);
}

export async function writeCustomSeats(seats: number) {
  if (!Number.isInteger(seats) || seats <= 100) return false;
  await readPlanPrices();
  const sql = getSql();
  await sql`
    insert into plan_prices (plan, seats, currency)
    values ('Custom', ${seats}, 'usd')
    on conflict (plan) do update set seats = excluded.seats
  `;
  revalidatePath("/admin");
  revalidatePath("/organization/plan");
  return true;
}

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function isPaidPlan(plan: string): plan is PaidPlan {
  return (paidPlans as readonly string[]).includes(plan);
}

export async function applyPaidPlan(organizationId: string, plan: string, term: PlanTerm = "year") {
  if (!isPaidPlan(plan) || !isId(organizationId)) return;
  await writePlan(organizationId, plan, "up", term);
}

export async function applySmallerPlan(organizationId: string, plan: string) {
  if (!isId(organizationId) || !plans.some((item) => item.name === plan)) return false;
  return writePlan(organizationId, plan, "down");
}

async function writePlan(organizationId: string, plan: string, direction: "up" | "down", term: PlanTerm = "year") {
  const sql = getSql();
  await sql`alter table organizations add column if not exists plan_until timestamptz`;
  const rows = await sql`select plan, plan_until as "planUntil" from organizations where id = ${organizationId} limit 1`;
  const stored = rows[0]?.plan ? String(rows[0].plan) : "";
  const until = rows[0]?.planUntil ? new Date(String(rows[0].planUntil)).toISOString() : null;
  const current = livePlan(stored, until);
  const next = await readSeatAllowance(plan);
  const now = await readSeatAllowance(current);
  if (!current || (direction === "up" ? next <= now : next >= now || next < 1)) return false;
  if (direction === "down") {
    await sql`update organizations set plan = ${plan}, plan_until = null where id = ${organizationId}`;
  } else if (term === "quarter") {
    await sql`update organizations set plan = ${plan}, plan_until = now() + interval '3 months' where id = ${organizationId}`;
  } else {
    await sql`update organizations set plan = ${plan}, plan_until = now() + interval '1 year' where id = ${organizationId}`;
  }
  revalidatePath("/", "layout");
  return true;
}

function isId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
