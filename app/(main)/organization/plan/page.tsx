import { Suspense } from "react";
import { readAccess } from "../../../auth/access";
import { livePlan, planCharge, readPlanPrices, readSeatAllowance, readStorageGb, termOpen, trialDaysLeft, type PlanPrice } from "../billing";
import { settlePayment } from "./actions";
import { PaidToast } from "./paid-toast";
import { PageIntro } from "../chrome";
import { readOrganization } from "../queries";
import { planAccent, plans } from "../sample";
import { CustomOffer, PlanButton } from "./choose-plan";

export default function PlanPage({ searchParams }: { searchParams: Promise<{ checkout?: string | string[]; session_id?: string | string[] }> }) {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading plan.</p>}>
      <PlanBody searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanBody({ searchParams }: { searchParams: Promise<{ checkout?: string | string[]; session_id?: string | string[] }> }) {
  const query = await searchParams;
  const sessionId = Array.isArray(query.session_id) ? query.session_id[0] : query.session_id;
  if (sessionId) await settlePayment(sessionId);
  const [organization, access, prices] = await Promise.all([readOrganization(), readAccess(), readPlanPrices()]);
  const current = livePlan(organization?.plan ?? "Personal", organization?.planUntil ?? null);
  const open = termOpen(organization?.planUntil ?? null);
  const until = open && organization?.planUntil ? formatTerm(organization.planUntil) : null;
  const trialDays = organization?.plan === "Personal" && !open ? trialDaysLeft(organization.trialUntil) : null;
  const used = organization?.seats.length ?? 0;
  const allowance = await readSeatAllowance(current);
  const full = used >= allowance;
  const owner = access.role === "Owner";
  const room = prices.find((item) => item.plan === "Room") ?? null;
  const checkout = Array.isArray(query.checkout) ? query.checkout[0] : query.checkout;
  const notice = checkout === "cancelled" ? "The payment was cancelled." : "";
  const paidSession = checkout === "received" && sessionId ? sessionId : null;
  const cards = await Promise.all(
    plans.map(async (plan) => {
      const price = planCharge(prices, plan.name);
      const seats = plan.name === "Custom" ? price?.seats ?? null : await readSeatAllowance(plan.name);
      const storage = await readStorageGb(plan.name);
      return { plan, price, seats, storage };
    }),
  );
  const seatsOf = (name: string) => cards.find((card) => card.plan.name === name)?.seats ?? 0;
  const storageOf = (name: string) => cards.find((card) => card.plan.name === name)?.storage ?? 0;
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="PLAN"
        title="Plan"
        detail={
          full
            ? `${current} includes ${allowance === 1 ? "1 seat" : `${allowance} seats`}. Another seat needs a larger plan.`
            : `A personal copy is ${seatsOf("Personal") === 1 ? "1 seat" : `${seatsOf("Personal")} seats`}. House holds ${seatsOf("House")} seats and Room holds ${seatsOf("Room")} seats. Custom starts above 100.`
        }
      />
      {notice ? <p className="text-[14px] font-semibold text-ink">{notice}</p> : null}
      <PaidToast sessionId={paidSession} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ plan, price, seats, storage }) => {
          const selected = plan.name === current;
          const count = seats ?? 101;
          const terms = termsFor(price);
          const buyingPersonal = owner && plan.name === "Personal" && current === "Personal" && !open && terms.length > 0;
          const intent = buyingPersonal ? "upgrade" : owner && count > allowance ? "upgrade" : owner && !open && seats != null && count < allowance ? "choose" : null;
          const accent = planAccent(plan.name);
          return (
            <li key={plan.name} className="flex flex-col rounded-2xl bg-surface p-5" style={selected ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-ink">{plan.name}</h2>
                <div className="flex items-center gap-2">
                  {storage ? (
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white" style={{ background: accent }}>
                      {storage} GB
                    </span>
                  ) : null}
                  {selected ? (
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white" style={{ background: accent }}>
                      Current
                    </span>
                  ) : null}
                </div>
              </div>
              {plan.name === "Custom" ? (
                <CustomOffer
                  saved={price?.seats ? String(price.seats) : ""}
                  roomQuarter={room?.quarterCents ?? null}
                  roomYear={room?.yearCents ?? null}
                  currency={room?.currency ?? price?.currency ?? "usd"}
                  detail={plan.detail}
                  owner={owner}
                  allowance={allowance}
                  selected={selected}
                  used={used}
                  until={selected ? until : null}
                  held={open}
                  storage={storage}
                  accent={accent}
                />
              ) : (
                <div className="flex flex-1 flex-col">
                  <p className="mt-4 text-[36px] leading-none font-bold tracking-tight text-ink">{seats ?? "100+"}</p>
                  <p className="mt-1 text-[12px] font-semibold tracking-[0.14em] text-muted">{count === 1 ? "SEAT" : "SEATS"}</p>
                  <p className="mt-4 text-[14px] leading-6 text-muted">{plan.detail}</p>
                  {trialDays != null && plan.name === "Personal" ? <TrialDays days={trialDays} /> : null}
                  {price ? <PriceLines price={price} /> : null}
                  {selected ? <SeatUse used={used} count={count} until={until} /> : null}
                  {intent === "choose" || (intent === "upgrade" && terms.length > 0) ? (
                    <PlanButton plan={plan.name} intent={intent} terms={terms} seats={count} currency={price?.currency ?? "usd"} storage={storage} accent={accent} />
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="max-w-xl text-[14px] leading-6 text-muted">
        {owner
          ? until
            ? `Personal includes ${storageOf("Personal")} GB. House includes ${storageOf("House")} GB. Room includes ${storageOf("Room")} GB. Custom includes ${storageOf("Custom")} GB. Another plan can be chosen after ${until}.`
            : `Personal includes ${storageOf("Personal")} GB. House includes ${storageOf("House")} GB. Room includes ${storageOf("Room")} GB. Custom includes ${storageOf("Custom")} GB. The plan runs for the term that was paid.`
          : "The owner chooses the plan."}
      </p>
    </div>
  );
}

function TrialDays({ days }: { days: number }) {
  const label = days === 1 ? "1 day left" : `${days} days left`;
  return <p className="mt-3 text-[13px] font-semibold text-[#e4372d]">{label}</p>;
}

function SeatUse({ used, count, until }: { used: number; count: number; until: string | null }) {
  const seats = count === 1 ? "seat" : "seats";
  return (
    <p className="mt-5 text-[12px] text-muted">
      {used} of {count} {seats} in use{until ? ` through ${until}` : ""}
    </p>
  );
}

function formatTerm(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function PriceLines({ price }: { price: PlanPrice }) {
  const lines = [
    price.quarterCents ? `${formatPrice(price.quarterCents, price.currency)}/m for 3 months` : "",
    price.yearCents ? `${formatPrice(price.yearCents, price.currency)}/m for 1 year` : "",
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div className="mt-3 grid gap-1">
      {lines.map((line) => (
        <p key={line} className="text-[13px] leading-5 text-muted">
          {line}
        </p>
      ))}
    </div>
  );
}

function termsFor(price: PlanPrice | null) {
  if (!price) return [];
  const terms: { term: "quarter" | "year"; label: string; cents: number }[] = [];
  if (price.quarterCents) terms.push({ term: "quarter", label: "3 months", cents: price.quarterCents });
  if (price.yearCents) terms.push({ term: "year", label: "1 year", cents: price.yearCents });
  return terms;
}

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  if (currency.toLowerCase() === "usd") return `$${value}`;
  return `${value} ${currency.toUpperCase()}`;
}
