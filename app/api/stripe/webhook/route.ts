import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { applyPaidPlan, stripeClient, type PlanTerm } from "../../../(main)/organization/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Payments are not set up yet." }, { status: 500 });

  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "The signature did not match." }, { status: 400 });
  }

  const session = paidSession(event);
  if (session?.metadata) {
    const term: PlanTerm = session.metadata.term === "quarter" ? "quarter" : "year";
    await applyPaidPlan(session.metadata.organizationId ?? "", session.metadata.plan ?? "", term);
  }
  return NextResponse.json({ received: true });
}

function paidSession(event: Stripe.Event) {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return null;
  const session = event.data.object;
  if (event.type === "checkout.session.completed" && session.payment_status !== "paid") return null;
  return session;
}
