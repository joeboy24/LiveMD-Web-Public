import { Suspense } from "react";
import { PageIntro } from "../chrome";
import { readOrganization } from "../queries";
import { plans, seatLimit } from "../sample";

export default function PlanPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading plan.</p>}>
      <PlanBody />
    </Suspense>
  );
}

async function PlanBody() {
  const organization = await readOrganization();
  const current = organization?.plan ?? "Personal";
  const used = organization?.seats.length ?? 0;
  const allowance = seatLimit(current);
  const full = used >= allowance;
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="PLAN"
        title="Plan"
        detail={
          full
            ? `${current} includes ${allowance === 1 ? "1 seat" : `${allowance} seats`}. Another seat needs a larger plan.`
            : "A personal copy is one seat. An organization can hold a block of 50 or 100."
        }
      />
      <ul className="grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const selected = plan.name === current;
          return (
            <li key={plan.name} className={selected ? "flex flex-col rounded-2xl bg-surface p-5 ring-2 ring-primary" : "flex flex-col rounded-2xl bg-surface p-5"}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-ink">{plan.name}</h2>
                {selected ? <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">Current</span> : null}
              </div>
              <p className="mt-4 text-[36px] leading-none font-bold tracking-tight text-ink">{plan.seats}</p>
              <p className="mt-1 text-[12px] font-semibold tracking-[0.14em] text-muted">{plan.seats === 1 ? "SEAT" : "SEATS"}</p>
              <p className="mt-4 text-[14px] leading-6 text-muted">{plan.detail}</p>
              {selected ? (
                <p className="mt-5 text-[12px] text-muted">
                  {used} of {plan.seats} {plan.seats === 1 ? "seat" : "seats"} in use
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="max-w-xl text-[14px] leading-6 text-muted">House and Room are the larger plans. A card is not charged on this page yet.</p>
    </div>
  );
}
