"use client";

import { useActionState, useEffect, useState } from "react";
import { FiCreditCard, FiX } from "react-icons/fi";
import { buyPlan, readCheckoutDiscount, type CheckoutDiscount, type PlanState } from "../(main)/organization/plan/actions";
import { orderCents, termTotalCents } from "../(main)/organization/sample";
import { chooseFeature, type CheckoutDraft } from "./panel";

const initial: PlanState = { error: null };

export function CheckoutSheet({ draft }: { draft: CheckoutDraft }) {
  const [state, action, pending] = useActionState(buyPlan, initial);
  const [term, setTerm] = useState(draft.terms.find((item) => item.term === "year")?.term ?? draft.terms[0]?.term ?? "year");
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState<CheckoutDiscount | null>(null);
  const [miss, setMiss] = useState(false);
  const choice = draft.terms.find((item) => item.term === term) ?? draft.terms[0];
  const total = choice ? termTotalCents(choice.cents, choice.term) : null;
  const offer = discount?.found ? discount : null;
  const due = total == null ? null : orderCents(total, offer);
  const seats = draft.seats === 1 ? "1 seat" : `${draft.seats} seats`;

  useEffect(() => {
    if (code.length !== 7) return;
    let live = true;
    void readCheckoutDiscount(code).then((result) => {
      if (!live) return;
      setDiscount(result.found ? result : null);
      setMiss(!result.found);
    });
    return () => {
      live = false;
    };
  }, [code]);

  if (!choice) return null;
  return (
    <form action={action} className="border-t border-surface-elevated px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">CHECKOUT</p>
        <button
          type="button"
          aria-label="Close checkout"
          onClick={() => chooseFeature("checkout")}
          className="grid size-7 place-items-center rounded-full text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          <FiX aria-hidden className="size-4" />
        </button>
      </div>
      <h2 className="mt-3 text-[18px] font-semibold tracking-tight text-ink">{draft.plan}</h2>
      <p className="mt-1 text-[13px] leading-5 text-muted">
        {seats}
        {draft.storage ? ` · ${draft.storage} GB` : ""}
      </p>
      <div className="mt-4 grid gap-2">
        {draft.terms.map((item) => {
          const on = item.term === choice.term;
          return (
            <button
              key={item.term}
              type="button"
              aria-pressed={on}
              onClick={() => setTerm(item.term)}
              data-help={`Pay for ${draft.plan} for ${item.label}.`}
              className={`rounded-xl px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${on ? "bg-primary text-white" : "bg-background text-ink hover:text-primary-hover"}`}
            >
              <span className={`block text-[11px] font-semibold tracking-[0.12em] uppercase ${on ? "text-white/80" : "text-muted"}`}>{item.label}</span>
              <span className="mt-1 block text-[18px] leading-none font-semibold tracking-tight tabular-nums">{money(item.cents, draft.currency)}/m</span>
            </button>
          );
        })}
      </div>
      <label className="mt-4 block">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Discount</span>
        <input
          name="discount"
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          aria-label="Discount code"
          value={code}
          onChange={(event) => {
            const next = codeText(event.target.value);
            setCode(next);
            if (next.length !== 7) {
              setDiscount(null);
              setMiss(false);
            }
          }}
          className="mt-1.5 w-full rounded-xl bg-background px-3 py-2 text-[15px] font-semibold tracking-[0.16em] text-ink uppercase outline-none ring-1 ring-surface-elevated focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>
      {offer ? <p className="mt-1.5 text-right text-[12px] font-semibold text-muted">{offLine(offer, draft.currency)}</p> : null}
      {miss ? <p className="mt-1.5 text-right text-[12px] font-semibold text-[#e4372d]">This code is incorrect.</p> : null}
      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-surface-elevated pt-3">
        <span className="text-[13px] font-semibold text-ink">Total</span>
        <span className="text-[22px] leading-none font-semibold tracking-tight text-ink tabular-nums">{due == null ? "" : money(due, draft.currency)}</span>
      </div>
      <p className="mt-2 text-[13px] leading-5 text-muted">Covers {choice.label}.</p>
      <input type="hidden" name="plan" value={draft.plan} />
      <input type="hidden" name="term" value={choice.term} />
      <input type="hidden" name="seats" value={String(draft.seats)} />
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        data-help={`Pay for ${draft.plan} for ${choice.label}.`}
        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[13px] font-semibold text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover disabled:opacity-50"
      >
        <FiCreditCard aria-hidden className="size-3.5" />
        <span>{pending ? "Opening" : "Pay"}</span>
      </button>
    </form>
  );
}

function offLine(discount: Exclude<CheckoutDiscount, { found: false }>, currency: string) {
  if (discount.kind === "percent" && discount.percent) return `${discount.percent}% off this order`;
  if (discount.amountCents) return `${money(discount.amountCents, currency)} off this order`;
  return "";
}

function codeText(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function money(cents: number, currency: string) {
  const amount = cents / 100;
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  if (currency.toLowerCase() === "usd") return `$${value}`;
  return `${value} ${currency.toUpperCase()}`;
}
