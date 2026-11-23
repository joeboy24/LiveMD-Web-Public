"use client";

import { useMemo, useState } from "react";
import { FiChevronDown, FiCopy, FiSearch } from "react-icons/fi";
import { Toast } from "../../components/toast";
import { planAccent } from "../organization/sample";
import type { PlatformOrg, PlatformPayment, PlatformSeat } from "../../admin/platform";

export function OrganizationList({ organizations }: { organizations: PlatformOrg[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "info"; stamp: number } | null>(null);
  const shown = useMemo(() => organizations.filter((organization) => matches(organization, query)), [organizations, query]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: "Copied.", tone: "success", stamp: Date.now() });
    } catch {
      setToast({ message: "Select the email to copy it.", tone: "info", stamp: Date.now() });
    }
  }

  return (
    <div className="grid gap-3">
      <label className="relative block max-w-xl">
        <FiSearch aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Organization, name, or email"
          aria-label="Find by organization, name, or email"
          className="h-12 w-full rounded-xl bg-surface pr-3 pl-10 text-[15px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary-hover"
        />
      </label>
      {shown.length === 0 ? <p className="text-[13px] text-muted">{organizations.length === 0 ? "No organizations yet." : "No organizations match."}</p> : null}
      <ul className="grid gap-2">
        {shown.map((organization) => (
          <Organization
            key={organization.id}
            organization={organization}
            open={openId === organization.id}
            onOpen={() => setOpenId((current) => (current === organization.id ? null : organization.id))}
            onCopy={(email) => void copy(email)}
          />
        ))}
      </ul>
      <Toast key={toast?.stamp} message={toast?.message ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </div>
  );
}

function Organization({
  organization,
  open,
  onOpen,
  onCopy,
}: {
  organization: PlatformOrg;
  open: boolean;
  onOpen: () => void;
  onCopy: (email: string) => void;
}) {
  const owner = organization.seats.find((seat) => seat.role === "Owner") ?? organization.seats[0];
  const standing = status(organization);
  return (
    <li className="overflow-hidden rounded-2xl bg-surface ring-1 ring-surface-elevated">
      <button
        type="button"
        aria-expanded={open}
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{organization.name}</span>
          <span className="block truncate text-[13px] text-muted">{owner?.email || "No owner email"}</span>
        </span>
        <span className={`hidden text-[12px] font-semibold sm:block ${standing.warn ? "text-[#e4372d]" : "text-muted"}`}>{standing.text}</span>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white" style={{ background: planAccent(organization.livePlan) }}>
          {organization.livePlan}
        </span>
        <span className="hidden text-[12px] font-semibold text-muted md:block">{organization.seats.length} {organization.seats.length === 1 ? "seat" : "seats"}</span>
        <FiChevronDown aria-hidden className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="grid gap-5 border-t border-surface-elevated px-4 py-4 lg:grid-cols-2">
          <section>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">SEATS</p>
              <p className="text-[12px] text-muted">Created {written(organization.createdAt)} · {organization.shows} {organization.shows === 1 ? "show" : "shows"}</p>
            </div>
            {organization.plan !== organization.livePlan ? <p className="mt-2 text-[13px] leading-5 text-muted">The last paid plan was {organization.plan}. That term has ended.</p> : null}
            {organization.seats.length === 0 ? <p className="mt-2 text-[13px] text-muted">No seats.</p> : null}
            <ul className="mt-2 grid gap-2">
              {organization.seats.map((seat) => (
                <Seat key={seat.id} seat={seat} onCopy={onCopy} />
              ))}
            </ul>
          </section>
          <section>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">PAYMENTS</p>
              <p className="text-[12px] text-muted">{organization.paymentCount} {organization.paymentCount === 1 ? "payment" : "payments"}</p>
            </div>
            {organization.payments.length === 0 ? <p className="mt-2 text-[13px] text-muted">No payments yet.</p> : null}
            <ul className="mt-2 grid gap-2">
              {organization.payments.map((payment) => (
                <Payment key={payment.id} payment={payment} />
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </li>
  );
}

function Seat({ seat, onCopy }: { seat: PlatformSeat; onCopy: (email: string) => void }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{seat.name}</span>
        <span className="block truncate text-[13px] text-muted">{seat.email || "No email"}</span>
      </span>
      <span className="text-[12px] font-semibold text-muted">{seat.role}</span>
      <span className="hidden text-[12px] font-semibold text-muted sm:block">{seat.invited ? "Invited" : seat.signedIn ? "Signed in" : "No account"}</span>
      {seat.email ? (
        <button
          type="button"
          aria-label={`Copy ${seat.email}`}
          onClick={() => onCopy(seat.email)}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          <FiCopy aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </li>
  );
}

function Payment({ payment }: { payment: PlatformPayment }) {
  return (
    <li className="rounded-xl bg-background px-3 py-2.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-semibold text-ink">{payment.plan} · {payment.term}</span>
        <span className="text-[14px] font-semibold text-ink tabular-nums">{money(payment.amountCents, payment.currency)}</span>
      </span>
      <span className="mt-1 block text-[13px] text-muted">
        {written(payment.paidAt)}
        {payment.discount ? ` · ${payment.discount}` : ""}
        {payment.creditCents > 0 ? ` · ${money(payment.creditCents, payment.currency)} credit` : ""}
        {payment.receiptSent ? " · Receipt sent" : " · Receipt not sent"}
      </span>
    </li>
  );
}

function matches(organization: PlatformOrg, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (organization.name.toLowerCase().includes(needle)) return true;
  return organization.seats.some((seat) => seat.name.toLowerCase().includes(needle) || seat.email.toLowerCase().includes(needle));
}

function status(organization: PlatformOrg) {
  if (organization.paid && organization.planUntil) return { text: `Paid through ${written(organization.planUntil)}`, warn: false };
  if (organization.trialDays != null && organization.trialDays > 0) return { text: `${organization.trialDays} ${organization.trialDays === 1 ? "day" : "days"} left`, warn: true };
  if (organization.trialDays === 0) return { text: "Trial ended", warn: true };
  return { text: "No payment", warn: false };
}

function written(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
