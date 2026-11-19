import { PaymentReceived } from "../../components/payment-received";

const samples = [
  { plan: "House", seats: "50", storage: "100", label: "1 year" },
  { plan: "Room", seats: "100", storage: "100", label: "1 year" },
  { plan: "Custom", seats: "150", storage: "150", label: "1 year" },
];

export default async function ReceivedPreview({ searchParams }: { searchParams: Promise<{ plan?: string; seats?: string; storage?: string; label?: string }> }) {
  const query = await searchParams;
  const plan = query.plan || "Room";
  const seats = numberOr(query.seats, 100);
  const storage = query.storage === "0" ? null : numberOr(query.storage, 100);
  const label = query.label || "1 year";
  return (
    <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-96">
        <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_18px_40px_rgb(0_0_0/0.18)] ring-1 ring-white/10">
          <div className="h-1 bg-[linear-gradient(90deg,#25C290,#38A7E2,#FA8E23)]" />
          <PaymentReceived plan={plan} seats={seats} storage={storage} label={label} />
        </div>
        <nav className="mt-4 flex justify-center gap-3 text-[13px] font-semibold">
          {samples.map((sample) => {
            const on = sample.plan === plan;
            const href = `/preview/received?plan=${sample.plan}&seats=${sample.seats}&storage=${sample.storage}&label=${encodeURIComponent(sample.label)}`;
            return (
              <a key={sample.plan} href={href} className={on ? "text-ink" : "text-muted hover:text-ink"} aria-current={on ? "page" : undefined}>
                {sample.plan}
              </a>
            );
          })}
        </nav>
      </div>
    </main>
  );
}

function numberOr(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
