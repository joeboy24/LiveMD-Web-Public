"use server";

import { redirect } from "next/navigation";
import { readAccess } from "../../../auth/access";
import { appOrigin } from "../../../auth/mail";
import { readSessionAccount } from "../../../auth/queries";
import { applySmallerPlan, isPaidPlan, livePlan, paymentsConfigured, readPlanPrice, readSeatAllowance, stripeClient, writeCustomSeats, type PlanTerm } from "../billing";
import { termTotalCents } from "../sample";
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
            unit_amount: cents,
            product_data: { name: `Live MD ${plan} · ${label}` },
          },
        },
      ],
      success_url: `${origin}/organization/plan?checkout=received`,
      cancel_url: `${origin}/organization/plan?checkout=cancelled`,
      customer_email: account?.email,
      metadata: { organizationId: organization.id, plan, term },
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

function termFrom(value: FormDataEntryValue | null): PlanTerm | null {
  const term = String(value ?? "");
  return term === "quarter" || term === "year" ? term : null;
}
