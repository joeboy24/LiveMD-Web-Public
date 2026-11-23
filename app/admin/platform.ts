import { readSystemPages } from "./access";
import { getSql } from "../db";
import { livePlan, readPlanPrices, termOpen, trialDaysLeft } from "../(main)/organization/billing";
import { ensureOrganizationTables } from "../(main)/organization/queries";

export type PlatformSeat = {
  id: string;
  name: string;
  email: string;
  role: string;
  invited: boolean;
  signedIn: boolean;
};

export type PlatformPayment = {
  id: string;
  plan: string;
  term: string;
  amountCents: number;
  currency: string;
  discount: string;
  creditCents: number;
  receiptSent: boolean;
  paidAt: string;
};

export type PlatformOrg = {
  id: string;
  name: string;
  plan: string;
  livePlan: string;
  planUntil: string | null;
  trialDays: number | null;
  paid: boolean;
  createdAt: string;
  shows: number;
  paymentCount: number;
  seats: PlatformSeat[];
  payments: PlatformPayment[];
};

function truthy(value: unknown) {
  return value === true || value === "t" || value === "true";
}

export async function readPlatform(): Promise<PlatformOrg[]> {
  if (!(await readSystemPages()).includes("organizations")) return [];
  await ensureOrganizationTables();
  await readPlanPrices();
  const sql = getSql();
  const [organizations, seats, payments, showCounts] = await Promise.all([
    sql`
      select id, name, plan, plan_until as "planUntil", trial_until as "trialUntil", created_at as "createdAt"
      from organizations
      order by lower(name) asc, created_at asc
    `,
    sql`
      select id, organization_id as "organizationId", name, email, role, invited_at, accepted_at, account_id
      from seats
      order by created_at asc
    `,
    sql`
      select id, organization_id as "organizationId", plan, term, amount_cents as "amountCents",
        currency, discount, credit_cents as "creditCents", receipt_sent as "receiptSent", paid_at as "paidAt"
      from payments
      order by paid_at desc
    `,
    sql`
      select organization_id as "organizationId", count(*) as shows
      from shows
      where organization_id is not null
      group by organization_id
    `,
  ]);

  const seatsByOrg = new Map<string, PlatformSeat[]>();
  for (const seat of seats) {
    const orgId = seat.organizationId ? String(seat.organizationId) : "";
    if (!orgId) continue;
    const list = seatsByOrg.get(orgId) ?? [];
    list.push({
      id: String(seat.id),
      name: seat.name ? String(seat.name) : "Seat",
      email: seat.email ? String(seat.email) : "",
      role: seat.role ? String(seat.role) : "Owner",
      invited: seat.invited_at != null && seat.accepted_at == null,
      signedIn: Boolean(seat.account_id),
    });
    seatsByOrg.set(orgId, list);
  }

  const paymentsByOrg = new Map<string, PlatformPayment[]>();
  const paymentCounts = new Map<string, number>();
  for (const payment of payments) {
    const orgId = payment.organizationId ? String(payment.organizationId) : "";
    const amount = Number(payment.amountCents);
    const paidAt = payment.paidAt ? new Date(String(payment.paidAt)).toISOString() : "";
    if (!orgId || !paidAt || !Number.isInteger(amount)) continue;
    paymentCounts.set(orgId, (paymentCounts.get(orgId) ?? 0) + 1);
    const list = paymentsByOrg.get(orgId) ?? [];
    list.push({
      id: String(payment.id),
      plan: payment.plan ? String(payment.plan) : "",
      term: payment.term === "year" ? "1 year" : "3 months",
      amountCents: amount,
      currency: payment.currency ? String(payment.currency) : "usd",
      discount: payment.discount ? String(payment.discount) : "",
      creditCents: Number.isInteger(Number(payment.creditCents)) ? Number(payment.creditCents) : 0,
      receiptSent: truthy(payment.receiptSent),
      paidAt,
    });
    paymentsByOrg.set(orgId, list);
  }

  const showsByOrg = new Map<string, number>();
  for (const row of showCounts) {
    const orgId = row.organizationId ? String(row.organizationId) : "";
    const count = Number(row.shows);
    if (orgId && Number.isInteger(count)) showsByOrg.set(orgId, count);
  }

  return organizations.flatMap((row) => {
    const id = row.id ? String(row.id) : "";
    const name = row.name ? String(row.name) : "";
    if (!id || !name) return [];
    const plan = row.plan ? String(row.plan) : "Personal";
    const planUntil = row.planUntil ? new Date(String(row.planUntil)).toISOString() : null;
    const trialUntil = row.trialUntil ? new Date(String(row.trialUntil)).toISOString() : null;
    const paid = termOpen(planUntil);
    const createdAt = row.createdAt ? new Date(String(row.createdAt)).toISOString() : "";
    if (!createdAt) return [];
    return [{
      id,
      name,
      plan,
      livePlan: livePlan(plan, planUntil),
      planUntil: paid ? planUntil : null,
      trialDays: plan === "Personal" && !paid ? trialDaysLeft(trialUntil) : null,
      paid,
      createdAt,
      shows: showsByOrg.get(id) ?? 0,
      paymentCount: paymentCounts.get(id) ?? 0,
      seats: seatsByOrg.get(id) ?? [],
      payments: paymentsByOrg.get(id) ?? [],
    }];
  });
}
