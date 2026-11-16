import type { ReactNode } from "react";
import Link from "next/link";

export function PageIntro({
  eyebrow,
  title,
  detail,
  mark,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  mark?: ReactNode;
}) {
  return (
    <header>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">{eyebrow}</p>
        {mark}
      </div>
      <h1 className="mt-2 text-[32px] leading-none font-bold tracking-tight text-ink">{title}</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted">{detail}</p>
    </header>
  );
}

export function SampleMark() {
  return <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] font-semibold tracking-wide text-muted">Sample</span>;
}

export function Monogram({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-elevated text-[12px] font-semibold tracking-wide text-ink">
      {letters}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-4">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 text-[28px] leading-none font-bold tracking-tight text-ink">{value}</p>
    </div>
  );
}

const areas = [
  { href: "/organization/seats", title: "Seats", detail: "The people who can open the player." },
  { href: "/organization/roles", title: "Roles", detail: "Owner, music director, musician, and playback operator." },
  { href: "/organization/plan", title: "Plan", detail: "A personal copy, or a block of 50 or 100 seats." },
] as const;

export function AreaLinks() {
  return (
    <section>
      <h2 className="text-[13px] font-semibold tracking-[0.14em] text-muted">INSIDE</h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {areas.map((area) => (
          <li key={area.href}>
            <Link
              href={area.href}
              className="block h-full rounded-2xl bg-surface px-4 py-4 outline-none hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-primary-hover"
            >
              <span className="block text-[15px] font-semibold text-ink">{area.title}</span>
              <span className="mt-1.5 block text-[13px] leading-5 text-muted">{area.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
