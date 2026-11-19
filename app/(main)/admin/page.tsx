import { Suspense } from "react";
import { readPlanPrices } from "../organization/billing";
import { PageIntro } from "../organization/chrome";
import { planAccent, plans, storageGb } from "../organization/sample";
import { PriceForm } from "./price-form";

export default function AdminPricesPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading prices.</p>}>
      <Prices />
    </Suspense>
  );
}

async function Prices() {
  const prices = await readPlanPrices();
  const paid = plans;
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="SYSTEM"
        title="Prices"
        detail="Personal includes 10 GB. House and Room include 100 GB. Custom includes 150 GB. Above 100 seats its price is the seat count times the Room price, divided by 100."
      />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {paid.map((plan) => {
          const price = prices.find((item) => item.plan === plan.name);
          const room = prices.find((item) => item.plan === "Room");
          const accent = planAccent(plan.name);
          const custom = plan.name === "Custom";
          const shown = custom ? room : price;
          const seats = custom ? price?.seats ?? null : plan.seats;
          const storage = storageGb(plan.name);
          return (
            <li key={plan.name} className="flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-surface-elevated">
              <span className="h-1" style={{ background: accent }} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[18px] font-semibold tracking-tight text-ink">{plan.name}</h2>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white" style={{ background: accent }}>
                    {storage} GB
                  </span>
                </div>
                <PriceForm
                  className="mt-6 flex flex-1 flex-col"
                  plan={plan.name}
                  figure={String(seats ?? "100+")}
                  detail={plan.detail}
                  quarter={shown?.quarterCents ? dollars(shown.quarterCents) : ""}
                  year={shown?.yearCents ? dollars(shown.yearCents) : ""}
                  seats={price?.seats ? String(price.seats) : ""}
                  custom={custom}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function dollars(cents: number) {
  const amount = cents / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
