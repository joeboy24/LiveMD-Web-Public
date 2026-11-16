import { PageIntro, SampleMark } from "../chrome";
import { plans, sampleSeats } from "../sample";

export default function PlanPage() {
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="PLAN"
        title="Plan"
        detail="A personal copy is one seat. An organization can hold a block of 50 or 100."
      />
      <ul className="grid gap-3 md:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.name}
            className={
              plan.sample
                ? "flex flex-col rounded-2xl bg-surface p-5 ring-2 ring-primary"
                : "flex flex-col rounded-2xl bg-surface p-5"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-ink">{plan.name}</h2>
              {plan.sample ? <SampleMark /> : null}
            </div>
            <p className="mt-4 text-[36px] leading-none font-bold tracking-tight text-ink">{plan.seats}</p>
            <p className="mt-1 text-[12px] font-semibold tracking-[0.14em] text-muted">{plan.seats === 1 ? "SEAT" : "SEATS"}</p>
            <p className="mt-4 text-[14px] leading-6 text-muted">{plan.detail}</p>
            {plan.sample ? (
              <div className="mt-5">
                <div className="h-1.5 overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(sampleSeats.length / plan.seats) * 100}%` }} />
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  {sampleSeats.length} of {plan.seats} seats in this sample
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="max-w-xl text-[14px] leading-6 text-muted">The house of 50 is a sample, so the shape of a plan is visible before a plan can be charged.</p>
    </div>
  );
}
