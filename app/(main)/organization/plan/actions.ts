"use server";

import { readAccess } from "../../../auth/access";
import { appOrigin } from "../../../auth/mail";
import { readSessionAccount } from "../../../auth/queries";
import { getSql } from "../../../db";
import { applySmallerPlan, isPaidPlan, livePlan, paymentsConfigured, readDiscounts, readPlanPrice, readSeatAllowance, recordPaidSession, stripeClient, termOpen, writeCustomSeats, type PlanTerm } from "../billing";
import { orderCents, termTotalCents, type OrderDiscount } from "../sample";
import { readOrganization } from "../queries";
import { plans } from "../sample";

export type PlanState = { error: string | null; clientSecret?: string | null; lock?: string; sessionId?: string };

export async function buyPlan(_state: PlanState, formData: FormData): Promise<PlanState> {
  const access = await readAccess();
  if (access.role !== "Owner") return { error: "The owner holds the plan." };
  const plan = String(formData.get("plan") ?? "");
  const term = termFrom(formData.get("term"));
  if (!isPaidPlan(plan) || !term) return { error: "Upgrade to House, Room, or Custom." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  const current = livePlan(organization.plan, organization.planUntil);
  const nextSeats = await readSeatAllowance(plan);
  const nowSeats = await readSeatAllowance(current);
  const renewPersonal = plan === "Personal" && current === "Personal";
  if (nextSeats < nowSeats || (nextSeats === nowSeats && !renewPersonal)) return { error: "That plan is already in place." };
  if (!paymentsConfigured()) return { error: "Payments are not set up yet." };
  if (plan === "Custom") {
    const seats = Number(formData.get("seats"));
    if (!Number.isInteger(seats) || seats <= 100) return { error: "Custom should be more than 100." };
    await writeCustomSeats(seats);
  }
  const priced = await readPlanPrice(plan);
  const stripe = stripeClient();
  const monthly = term === "quarter" ? priced?.quarterCents : priced?.yearCents;
  const cents = termTotalCents(monthly ?? null, term);
  if (!stripe || !priced || !cents) return { error: "Payments are not set up yet." };
  if (plan === "Custom" && !(priced.seats && priced.seats > 100)) return { error: "Custom should be more than 100." };
  const discount = await discountFrom(formData.get("discount"));
  if (discount.error) return { error: discount.error };
  const charge = orderCents(cents, discount.offer);
  if (charge < 50) return { error: "That discount leaves less than 50 cents." };

  const account = await readSessionAccount();
  const origin = await appOrigin();
  const label = term === "quarter" ? "3 months" : "1 year";
  const seats = plan === "Custom" ? (priced.seats ?? 0) : await readSeatAllowance(plan);
  const lock = `${plan}:${term}:${charge}:${discount.code}`;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "elements",
      managed_payments: { enabled: false },
      allowed_payment_method_types: ["card"],
      return_url: `${origin}/organization/plan?checkout=received&session_id={CHECKOUT_SESSION_ID}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: priced.currency,
            unit_amount: charge,
            product_data: { name: `Live MD ${plan} · ${label}` },
          },
        },
      ],
      ...(account?.email ? { customer_email: account.email } : {}),
      metadata: { organizationId: organization.id, plan, term, seats: String(seats), ...(discount.offer ? { discount: discount.code } : {}) },
    });
    if (!session.client_secret) return { error: "The card form did not open.", clientSecret: null, lock: "", sessionId: "" };
    return { error: null, clientSecret: session.client_secret, lock, sessionId: session.id };
  } catch {
    return { error: "The card form did not open.", clientSecret: null, lock: "" };
  }
}

export async function settlePayment(sessionId: string) {
  const access = await readAccess();
  if (access.role !== "Owner" || !/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) return;
  const account = await readSessionAccount();
  const stripe = stripeClient();
  if (!account || !stripe) return;
  const sql = getSql();
  const rows = await sql`
    select organizations.id
    from seats
    join organizations on organizations.id = seats.organization_id
    where seats.account_id = ${account.id}
    order by seats.created_at asc
    limit 1
  `;
  const organizationId = rows[0]?.id ? String(rows[0].id) : "";
  if (!organizationId) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.organizationId !== organizationId) return;
    await recordPaidSession(session);
  } catch {
    return;
  }
}

export async function choosePlan(_state: PlanState, formData: FormData): Promise<PlanState> {
  const access = await readAccess();
  if (access.role !== "Owner") return { error: "The owner holds the plan." };
  const plan = String(formData.get("plan") ?? "");
  if (!plans.some((item) => item.name === plan)) return { error: "That plan is missing." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  const current = livePlan(organization.plan, organization.planUntil);
  if (termOpen(organization.planUntil)) return { error: "Another plan opens when this one ends." };
  if ((await readSeatAllowance(plan)) >= (await readSeatAllowance(current))) return { error: "That plan is already in place." };
  const saved = await applySmallerPlan(organization.id, plan);
  if (!saved) return { error: "That plan is already in place." };
  return { error: null };
}

export type CheckoutDiscount = { found: false } | ({ found: true } & OrderDiscount);

export async function readCheckoutDiscount(raw: string): Promise<CheckoutDiscount> {
  const access = await readAccess();
  if (access.role !== "Owner") return { found: false };
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{7}$/.test(code)) return { found: false };
  const match = (await readDiscounts()).find((item) => item.code === code);
  if (!match) return { found: false };
  return { found: true, kind: match.kind, percent: match.percent, amountCents: match.amountCents };
}

async function discountFrom(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return { error: null, code: "", offer: null };
  const code = raw.toUpperCase();
  if (!/^[A-Z0-9]{7}$/.test(code)) return { error: "This code is incorrect.", code: "", offer: null };
  const match = (await readDiscounts()).find((item) => item.code === code);
  if (!match) return { error: "That code is not available.", code: "", offer: null };
  return { error: null, code, offer: { kind: match.kind, percent: match.percent, amountCents: match.amountCents } };
}

function termFrom(value: FormDataEntryValue | null): PlanTerm | null {
  const term = String(value ?? "");
  return term === "quarter" || term === "year" ? term : null;
}
