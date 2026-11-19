"use client";

import { useActionState, useEffect, useState } from "react";
import { FiCopy, FiRefreshCw, FiX } from "react-icons/fi";
import { SaveButton } from "../../components/save-button";
import { Toast } from "../../components/toast";
import { removeDiscount, saveDiscount, type DiscountState } from "./actions";

const initial: DiscountState = { error: null, saved: false, stamp: "", code: "" };
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Kind = "percent" | "amount";

type Discount = {
  code: string;
  kind: Kind;
  percent: number | null;
  amountCents: number | null;
};

export function DiscountForm({ discounts }: { discounts: Discount[] }) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<Kind>("percent");
  const [off, setOff] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "info"; stamp: number } | null>(null);
  const [state, action, pending] = useActionState(saveDiscount, initial);
  const ready = kind === "percent" ? percentReady(off) : priceReady(off);

  useEffect(() => {
    if (!state.saved) return;
    setCode("");
    setOff("");
    setToast({ message: `${state.code} saved.`, tone: "success", stamp: Date.now() });
  }, [state.saved, state.stamp, state.code]);

  function draftCode() {
    const taken = new Set(discounts.map((item) => item.code));
    if (code) taken.add(code);
    setCode(freshCode(taken));
  }

  function chooseKind(next: Kind) {
    setKind(next);
    setOff((value) => (next === "percent" ? percentText(value.split(".")[0] ?? "") : moneyText(value)));
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: "Copied.", tone: "success", stamp: Date.now() });
    } catch {
      setToast({ message: "Select the code to copy it.", tone: "info", stamp: Date.now() });
    }
  }

  async function remove(value: string) {
    const result = await removeDiscount(value);
    setToast({
      message: result.saved ? "Removed." : (result.error ?? "That code is missing."),
      tone: result.saved ? "success" : "info",
      stamp: Date.now(),
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-surface-elevated">
      <span className="block h-1 bg-primary" />
      <div className="p-5">
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">Discounts</h2>
        <p className="mt-2 max-w-xl text-[14px] leading-6 text-muted">A code is up to 7 letters and numbers. Take a percent off, or a dollar amount off.</p>
        <form action={action} className="mt-5 grid items-stretch gap-4 lg:grid-cols-[minmax(240px,1fr)_minmax(280px,1fr)_auto]">
          <input type="hidden" name="kind" value={kind} />
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Code</span>
            <span className="group relative flex items-center overflow-hidden rounded-2xl bg-background ring-1 ring-surface-elevated">
              <input
                name="code"
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={7}
                aria-label="Discount code"
                value={code}
                onChange={(event) => setCode(codeText(event.target.value))}
                className="w-full bg-transparent px-3.5 py-3 text-[22px] leading-none font-semibold tracking-[0.22em] text-ink uppercase outline-none"
              />
              <button
                type="button"
                aria-label="Generate a code"
                onClick={draftCode}
                className="mr-2 grid size-8 shrink-0 place-items-center rounded-full text-ink outline-none hover:bg-surface hover:text-primary focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                <FiRefreshCw aria-hidden className="size-3.5" />
              </button>
              <span className="absolute inset-x-3.5 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform group-focus-within:scale-x-100" />
            </span>
          </label>
          <div className="grid gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Off</span>
            <div className="group relative flex items-center overflow-hidden rounded-2xl bg-background ring-1 ring-surface-elevated">
              <div className="flex shrink-0 p-1.5">
                <KindButton on={kind === "percent"} label="Percent" onClick={() => chooseKind("percent")} />
                <KindButton on={kind === "amount"} label="Price" onClick={() => chooseKind("amount")} />
              </div>
              <label className="flex min-w-0 flex-1 items-baseline gap-1 pr-3.5">
                {kind === "amount" ? <span className="text-[15px] font-semibold text-muted">$</span> : null}
                <input
                  name="off"
                  type="text"
                  inputMode={kind === "percent" ? "numeric" : "decimal"}
                  autoComplete="off"
                  aria-label={kind === "percent" ? "Percent off" : "Price off"}
                  value={off}
                  onChange={(event) => setOff(kind === "percent" ? percentText(event.target.value) : moneyText(event.target.value))}
                  className="w-full bg-transparent py-3 text-[22px] leading-none font-semibold tracking-tight text-ink tabular-nums outline-none"
                />
                {kind === "percent" ? <span className="text-[15px] font-semibold text-muted">%</span> : null}
              </label>
              <span className="absolute inset-x-3.5 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform group-focus-within:scale-x-100" />
            </div>
          </div>
          <div className="grid gap-1.5 lg:grid-rows-[auto_minmax(0,1fr)]">
            <span aria-hidden className="text-[11px] font-semibold tracking-[0.14em] text-transparent uppercase">
              Off
            </span>
            <SaveButton pending={pending} pendingLabel="Generating" icon={FiRefreshCw} disabled={pending || !ready} className="h-full min-h-8 rounded-2xl px-3.5">
              Generate
            </SaveButton>
          </div>
          {state.error ? <p className="text-sm text-[#e4372d] lg:col-span-3">{state.error}</p> : null}
        </form>
        {discounts.length ? (
          <ul className="mt-5 grid gap-2">
            {discounts.map((discount) => (
              <li key={discount.code} className="flex items-center gap-3 rounded-xl bg-background px-3.5 py-2.5 ring-1 ring-surface-elevated">
                <span className="text-[15px] font-semibold tracking-[0.18em] text-ink">{discount.code}</span>
                <span className="text-[13px] font-semibold text-muted">{offText(discount)}</span>
                <span className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Copy ${discount.code}`}
                    onClick={() => void copy(discount.code)}
                    className="grid size-7 place-items-center rounded-full text-ink outline-none hover:bg-surface hover:text-primary focus-visible:ring-2 focus-visible:ring-primary-hover"
                  >
                    <FiCopy aria-hidden className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${discount.code}`}
                    onClick={() => void remove(discount.code)}
                    className="grid size-7 place-items-center rounded-full text-ink outline-none hover:bg-surface hover:text-[#e4372d] focus-visible:ring-2 focus-visible:ring-primary-hover"
                  >
                    <FiX aria-hidden className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-[13px] font-semibold text-muted">No codes yet.</p>
        )}
        <Toast key={toast?.stamp} message={toast?.message ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
      </div>
    </section>
  );
}

function KindButton({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${on ? "bg-primary text-white" : "text-muted hover:text-ink"}`}
    >
      {label}
    </button>
  );
}

function offText(discount: Discount) {
  if (discount.kind === "percent" && discount.percent) return `${discount.percent}% off`;
  if (discount.amountCents) return `$${dollars(discount.amountCents)} off`;
  return "";
}

function dollars(cents: number) {
  const amount = cents / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function freshCode(taken: Set<string>) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bytes = new Uint8Array(7);
    crypto.getRandomValues(bytes);
    const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    if (!taken.has(code)) return code;
  }
  return "";
}

function codeText(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function percentText(raw: string) {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 3);
  if (!digits) return "";
  return Number(digits) > 100 ? "100" : String(Number(digits));
}

function percentReady(value: string) {
  const percent = Number(value);
  return Number.isInteger(percent) && percent >= 1 && percent <= 100;
}

function priceReady(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2)) >= 50;
}

function moneyText(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const whole = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  if (dot === -1) return whole;
  return `${whole || "0"}.${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`;
}
