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
  const allowance = (name: string) => {
    const saved = prices.find((item) => item.plan === name);
    const fallback = plans.find((item) => item.name === name);
    return {
      seats: saved?.seats ?? (name === "Custom" ? null : fallback?.seats ?? null),
      storage: saved?.storageGb ?? storageGb(name),
    };
  };
  const stored = (name: string) => allowance(name).storage;
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="SYSTEM"
        title="Prices"
        detail={`Personal includes ${stored("Personal")} GB. House includes ${stored("House")} GB. Room includes ${stored("Room")} GB. Custom includes ${stored("Custom")} GB. Above 100 seats its price is the seat count times the Room price, divided by 100.`}
      />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {paid.map((plan) => {
          const price = prices.find((item) => item.plan === plan.name);
          const room = prices.find((item) => item.plan === "Room");
          const accent = planAccent(plan.name);
          const custom = plan.name === "Custom";
          const shown = custom ? room : price;
          const limits = allowance(plan.name);
          return (
            <li key={plan.name} className="flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-surface-elevated">
              <span className="h-1" style={{ background: accent }} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[18px] font-semibold tracking-tight text-ink">{plan.name}</h2>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white" style={{ background: accent }}>
                    {limits.storage} GB
                  </span>
                </div>
                <PriceForm
                  className="mt-6 flex flex-1 flex-col"
                  plan={plan.name}
                  figure={String(limits.seats ?? "100+")}
                  detail={plan.detail}
                  quarter={shown?.quarterCents ? dollars(shown.quarterCents) : ""}
                  year={shown?.yearCents ? dollars(shown.yearCents) : ""}
                  seats={limits.seats ? String(limits.seats) : ""}
                  storage={limits.storage ? String(limits.storage) : ""}
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
