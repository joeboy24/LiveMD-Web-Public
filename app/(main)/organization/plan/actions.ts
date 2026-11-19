"use server";

import { redirect } from "next/navigation";
import { readAccess } from "../../../auth/access";
import { appOrigin } from "../../../auth/mail";
import { readSessionAccount } from "../../../auth/queries";
import { applySmallerPlan, isPaidPlan, livePlan, paymentsConfigured, readDiscounts, readPlanPrice, readSeatAllowance, stripeClient, writeCustomSeats, type PlanTerm } from "../billing";
import { orderCents, termTotalCents, type OrderDiscount } from "../sample";
import { readOrganization } from "../queries";
import { plans } from "../sample";

export type PlanState = { error: string | null };

export async function buyPlan(_state: PlanState, formData: FormData): Promise<PlanState> {
  const access = await readAccess();
  if (access.role !== "Owner") return { error: "The owner holds the plan." };
  const plan = String(formData.get("plan") ?? "");
  const term = termFrom(formData.get("term"));
  if (!isPaidPlan(plan) || !term) return { error: "Upgrade to House, Room, or Custom." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  const current = livePlan(organization.plan, organization.planUntil);
  if ((await readSeatAllowance(plan)) <= (await readSeatAllowance(current))) return { error: "That plan is already in place." };
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
  let url = "";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
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
      success_url: `${origin}/organization/plan?checkout=received`,
      cancel_url: `${origin}/organization/plan?checkout=cancelled`,
      customer_email: account?.email,
      metadata: { organizationId: organization.id, plan, term, ...(discount.offer ? { discount: discount.code } : {}) },
    });
    url = session.url ?? "";
  } catch {
    return { error: "The payment page did not open." };
  }
  if (!url) return { error: "The payment page did not open." };
  redirect(url);
  return { error: null };
}

export async function choosePlan(_state: PlanState, formData: FormData): Promise<PlanState> {
  const access = await readAccess();
  if (access.role !== "Owner") return { error: "The owner holds the plan." };
  const plan = String(formData.get("plan") ?? "");
  if (!plans.some((item) => item.name === plan)) return { error: "That plan is missing." };
  const organization = await readOrganization();
  if (!organization) return { error: "Name the organization first." };
  const current = livePlan(organization.plan, organization.planUntil);
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
