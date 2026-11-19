"use client";

import { FiCheck, FiX } from "react-icons/fi";
import { planAccent } from "../(main)/organization/sample";

export function PaymentReceived({
  plan,
  seats,
  storage,
  label,
  onClose,
}: {
  plan: string;
  seats: number;
  storage: number | null;
  label: string;
  onClose?: () => void;
}) {
  const accent = planAccent(plan);
  const seatWord = seats === 1 ? "seat" : "seats";
  return (
    <div className="relative overflow-hidden px-4 pt-4 pb-6">
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 size-64 -translate-x-1/2 rounded-full blur-3xl" style={{ background: accent, opacity: 0.28 }} />
      <div className="relative flex justify-end">
        {onClose ? (
          <button
            type="button"
            aria-label="Close checkout"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-full text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <FiX aria-hidden className="size-4" />
          </button>
        ) : (
          <span className="size-7" />
        )}
      </div>
      <p className="relative text-center text-[11px] font-semibold tracking-[0.18em]" style={{ color: accent }}>
        PAYMENT RECEIVED
      </p>
      <div className="relative mx-auto mt-6 grid size-36 place-items-center">
        <span aria-hidden className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 10px ${accent}22, 0 0 0 1px ${accent}55` }} />
        <span className="grid size-28 place-items-center rounded-full text-white" style={{ background: accent }}>
          <span className="lyric-display text-[46px] leading-none font-bold tabular-nums">{seats}</span>
        </span>
        <span className="absolute -bottom-1 grid size-8 place-items-center rounded-full bg-surface text-white ring-4 ring-surface" style={{ background: accent }}>
          <FiCheck aria-hidden className="size-4" />
        </span>
      </div>
      <p className="relative mt-4 text-center text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">{seatWord}</p>
      <h2 className="relative mt-3 text-center text-[28px] leading-none font-semibold tracking-tight text-ink">{plan}</h2>
      <p className="relative mt-3 text-center text-[14px] leading-6 text-muted">
        {label ? `${label} is open` : "The plan is open"}
        {storage ? ` with ${storage} GB` : ""}.
      </p>
    </div>
  );
}
