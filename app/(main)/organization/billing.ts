import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { receiptLetter } from "../../auth/letter";
import { sendMail } from "../../auth/mail";
import { getSql } from "../../db";
import { customPriceCents, planAccent, plans, seatLimit, storageGb } from "./sample";

const paidPlans = ["Personal", "House", "Room", "Custom"] as const;

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

export function termOpen(planUntil: string | null) {
  return Boolean(planUntil && new Date(planUntil).getTime() > Date.now());
}

export function trialDaysLeft(trialUntil: string | null) {
  if (!trialUntil) return null;
  const left = new Date(trialUntil).getTime() - Date.now();
  if (!Number.isFinite(left)) return null;
  if (left <= 0) return 0;
  return Math.ceil(left / 86_400_000);
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
  await sql.query(
    `create table if not exists plan_discounts (
      code text primary key,
      kind text not null,
      percent integer,
      amount_cents integer,
      created_at timestamptz not null default now()
    )`,
  );
  await sql.query(
    `create table if not exists payments (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      stripe_session_id text not null unique,
      plan text not null,
      term text not null,
      seats integer not null,
      amount_cents integer not null,
      currency text not null default 'usd',
      discount text,
      email text,
      receipt_sent boolean not null default false,
      paid_at timestamptz not null default now()
    )`,
  );
  await sql.query(`create index if not exists payments_organization on payments (organization_id, paid_at desc)`);
  await sql.query(`alter table payments add column if not exists credit_cents integer`);
  await sql`
    insert into plan_prices (plan, quarter_cents, year_cents, currency)
    values ('Personal', 799, 699, 'usd')
    on conflict (plan) do nothing
  `;
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

export type DiscountKind = "percent" | "amount";

export type PlanDiscount = {
  code: string;
  kind: DiscountKind;
  percent: number | null;
  amountCents: number | null;
};

export async function readDiscounts() {
  await ensurePlanPrices();
  const sql = getSql();
  const rows = await sql`select code, kind, percent, amount_cents from plan_discounts order by created_at desc`;
  return rows.flatMap((row) => discountFrom(row));
}

export async function writeDiscount(input: { code: string; kind: DiscountKind; percent: number | null; amountCents: number | null }) {
  await ensurePlanPrices();
  const sql = getSql();
  const rows = await sql`
    insert into plan_discounts (code, kind, percent, amount_cents)
    values (${input.code}, ${input.kind}, ${input.percent}, ${input.amountCents})
    on conflict (code) do nothing
    returning code
  `;
  revalidatePath("/admin/discounts");
  return rows.length > 0;
}

export async function deleteDiscount(code: string) {
  await ensurePlanPrices();
  const sql = getSql();
  await sql`delete from plan_discounts where code = ${code}`;
  revalidatePath("/admin/discounts");
}

function discountFrom(row: Record<string, unknown>): PlanDiscount[] {
  const code = String(row.code ?? "").toUpperCase();
  const kind = row.kind === "percent" || row.kind === "amount" ? row.kind : null;
  if (!kind || !/^[A-Z0-9]{1,7}$/.test(code)) return [];
  const percent = Number(row.percent);
  const amountCents = Number(row.amount_cents);
  if (kind === "percent" && Number.isInteger(percent) && percent >= 1 && percent <= 100) {
    return [{ code, kind, percent, amountCents: null }];
  }
  if (kind === "amount" && Number.isInteger(amountCents) && amountCents >= 50) {
    return [{ code, kind, percent: null, amountCents }];
  }
  return [];
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

export function prorationCreditCents(paidCents: number, termStart: string, termEnd: string, now = Date.now()) {
  const start = new Date(termStart).getTime();
  const end = new Date(termEnd).getTime();
  const total = end - start;
  const left = end - now;
  if (!Number.isInteger(paidCents) || paidCents < 1 || total <= 0 || left <= 0) return 0;
  const credit = Math.round((paidCents * Math.min(left, total)) / total);
  return Math.min(paidCents, Math.max(0, credit));
}

export async function readProrationCredit(organizationId: string) {
  if (!isId(organizationId)) return 0;
  await ensurePlanPrices();
  const sql = getSql();
  const orgs = await sql`select plan, plan_until as "planUntil" from organizations where id = ${organizationId} limit 1`;
  const stored = orgs[0]?.plan ? String(orgs[0].plan) : "";
  const until = orgs[0]?.planUntil ? new Date(String(orgs[0].planUntil)).toISOString() : null;
  const current = livePlan(stored, until);
  if (!until || !termOpen(until)) return 0;
  const payments = await sql`
    select amount_cents, paid_at as "paidAt"
    from payments
    where organization_id = ${organizationId} and plan = ${current}
    order by paid_at desc
    limit 1
  `;
  const paid = Number(payments[0]?.amount_cents);
  const paidAt = payments[0]?.paidAt ? new Date(String(payments[0].paidAt)).toISOString() : "";
  if (!paidAt) return 0;
  return prorationCreditCents(paid, paidAt, until);
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

export async function recordPaidSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  const organizationId = session.metadata?.organizationId ?? "";
  const plan = session.metadata?.plan ?? "";
  const term: PlanTerm = session.metadata?.term === "quarter" ? "quarter" : "year";
  const amount = session.amount_total;
  if (!isPaidPlan(plan) || !isId(organizationId) || !session.id || !Number.isInteger(amount) || amount == null || amount < 50) return;
  const metaSeats = Number(session.metadata?.seats);
  const seats = Number.isInteger(metaSeats) && metaSeats > 0 ? metaSeats : await readSeatAllowance(plan);
  const email = session.customer_details?.email || session.customer_email || null;
  const discount = session.metadata?.discount || null;
  const creditRaw = Number(session.metadata?.credit);
  const credit = Number.isInteger(creditRaw) && creditRaw > 0 ? creditRaw : null;
  const currency = session.currency || "usd";
  await ensurePlanPrices();
  const sql = getSql();
  await sql`
    insert into payments (organization_id, stripe_session_id, plan, term, seats, amount_cents, currency, discount, credit_cents, email)
    values (${organizationId}, ${session.id}, ${plan}, ${term}, ${seats}, ${amount}, ${currency}, ${discount}, ${credit}, ${email})
    on conflict (stripe_session_id) do nothing
  `;
  await applyPaidPlan(organizationId, plan, term);
  if (!email) return;
  const claimed = await sql`
    update payments set receipt_sent = true
    where stripe_session_id = ${session.id} and receipt_sent = false
    returning id
  `;
  if (claimed.length === 0) return;
  const sent = await sendReceipt({ organizationId, plan, seats, term, amount, currency, discount, credit, email });
  if (!sent) await sql`update payments set receipt_sent = false where stripe_session_id = ${session.id}`;
}

async function sendReceipt(input: {
  organizationId: string;
  plan: string;
  seats: number;
  term: PlanTerm;
  amount: number;
  currency: string;
  discount: string | null;
  credit: number | null;
  email: string;
}) {
  const sql = getSql();
  const rows = await sql`select name from organizations where id = ${input.organizationId} limit 1`;
  const orgName = rows[0]?.name ? String(rows[0].name) : "Live MD";
  const letter = receiptLetter({
    orgName,
    plan: input.plan,
    seats: input.seats,
    term: input.term === "quarter" ? "3 months" : "1 year",
    amount: receiptMoney(input.amount, input.currency),
    discount: await discountLabel(input.discount, input.currency),
    credit: input.credit ? receiptMoney(input.credit, input.currency) : null,
    accent: planAccent(input.plan),
  });
  const result = await sendMail(input.email, letter.subject, letter.text, letter.html);
  return !result.error;
}

function receiptMoney(cents: number, currency: string) {
  const amount = cents / 100;
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  if (currency.toLowerCase() === "usd") return `$${value}`;
  return `${value} ${currency.toUpperCase()}`;
}

async function discountLabel(code: string | null, currency: string) {
  if (!code) return null;
  const match = (await readDiscounts()).find((item) => item.code === code);
  if (!match) return null;
  if (match.kind === "percent" && match.percent) return `${match.percent}%`;
  if (match.kind === "amount" && match.amountCents) return receiptMoney(match.amountCents, currency);
  return null;
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
  const renewPersonal = direction === "up" && plan === "Personal" && current === "Personal" && !termOpen(until);
  if (!current || (direction === "up" ? next < now || (next === now && !renewPersonal) : next >= now || next < 1)) return false;
  if (direction === "down" && termOpen(until)) return false;
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
