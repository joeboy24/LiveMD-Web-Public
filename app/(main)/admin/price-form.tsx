"use client";

import { useActionState, useEffect, useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import { SaveButton } from "../../components/save-button";
import { Toast } from "../../components/toast";
import { customPriceCents } from "../organization/sample";
import { saveCustomSeats, savePlanPrice, type PriceState } from "./actions";

const initial: PriceState = { error: null, saved: false, stamp: "" };

export function PriceForm({
  plan,
  quarter,
  year,
  seats = "",
  storage = "",
  trial = "",
  figure,
  detail,
  custom = false,
  className = "",
}: {
  plan: string;
  quarter: string;
  year: string;
  seats?: string;
  storage?: string;
  trial?: string;
  figure: string;
  detail: string;
  custom?: boolean;
  className?: string;
}) {
  const [quarterDollars, setQuarterDollars] = useState(quarter);
  const [yearDollars, setYearDollars] = useState(year);
  const [seatCount, setSeatCount] = useState(seats);
  const [storageCount, setStorageCount] = useState(storage);
  const [trialCount, setTrialCount] = useState(trial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "info"; stamp: number } | null>(null);
  const [state, action, pending] = useActionState(savePlanPrice, initial);
  const personal = plan === "Personal";
  const changed = quarterDollars.trim() !== quarter || yearDollars.trim() !== year || seatCount.trim() !== seats || storageCount.trim() !== storage || (personal && trialCount.trim() !== trial);
  const ready = changed && (quarterDollars.trim().length > 0 || yearDollars.trim().length > 0) && seatCount.trim().length > 0 && storageCount.trim().length > 0 && (!personal || trialCount.trim().length > 0);

  useEffect(() => {
    setQuarterDollars(quarter);
    setYearDollars(year);
    setSeatCount(seats);
    setStorageCount(storage);
    setTrialCount(trial);
  }, [quarter, year, seats, storage, trial]);

  useEffect(() => {
    if (!state.saved) return;
    setToast({ message: "Saved.", tone: "success", stamp: Date.now() });
  }, [state.saved, state.stamp]);

  async function commitSeats() {
    if (seatCount.trim() === seats || saving) return;
    if (!(Number(seatCount) > 100)) {
      setToast({ message: "Custom should be more than 100.", tone: "info", stamp: Date.now() });
      return;
    }
    setSaving(true);
    const result = await saveCustomSeats(seatCount);
    setSaving(false);
    if (!result.saved) {
      setToast({ message: result.error ?? "Custom should be more than 100.", tone: "info", stamp: Date.now() });
      return;
    }
    setToast({ message: "Saved.", tone: "success", stamp: Date.now() });
  }

  if (custom) {
    return (
      <div className={className}>
        <label className="group inline-flex w-fit cursor-text items-end gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="100+"
            aria-label="Seats"
            value={seatCount}
            onChange={(event) => setSeatCount(event.target.value.replace(/\D/g, ""))}
            style={{ width: `${Math.max((seatCount || "100+").length, 4) + 0.35}ch` }}
            className="border-b border-dashed border-muted bg-transparent text-[44px] leading-none font-bold tracking-tight text-ink outline-none placeholder:text-ink focus:border-solid focus:border-primary"
          />
          <FiEdit2 aria-hidden className="mb-1 size-3.5 text-muted group-focus-within:text-primary" />
        </label>
        <p className="mt-2 text-[12px] font-semibold tracking-[0.16em] text-muted">SEATS</p>
        <p className="mt-3 text-[14px] leading-6 text-muted">{detail}</p>
        <div className="mt-auto pt-6">
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-background ring-1 ring-surface-elevated">
            <PriceReadout label="3 months" value={scaledDollars(quarter, seatCount)} />
            <PriceReadout label="1 year" value={scaledDollars(year, seatCount)} divided />
          </div>
          <p className="mt-3 text-[12px] font-semibold text-muted">Per month, then ×3 or ×12. Seats × Room price ÷ 100.</p>
        </div>
        <SaveButton type="button" pending={saving} disabled={saving || seatCount.trim() === seats || seatCount.trim().length === 0} onClick={() => void commitSeats()} className="mt-4 self-start" />
        <Toast key={toast?.stamp} message={toast?.message ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
      </div>
    );
  }

  return (
    <form action={action} className={className}>
      <input type="hidden" name="plan" value={plan} />
      <p className="text-[44px] leading-none font-bold tracking-tight text-ink">{seatCount || figure}</p>
      <p className="mt-2 text-[12px] font-semibold tracking-[0.16em] text-muted">SEATS</p>
      <p className="mt-3 text-[14px] leading-6 text-muted">{detail}</p>
      <div className="mt-auto pt-6">
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-background ring-1 ring-surface-elevated">
          <MoneyField label="3 months" name="quarter" value={quarterDollars} onChange={setQuarterDollars} />
          <MoneyField label="1 year" name="year" value={yearDollars} onChange={setYearDollars} divided />
          <CountField label="Seats" name="seats" value={seatCount} onChange={setSeatCount} />
          <CountField label="GB" name="storage" value={storageCount} onChange={setStorageCount} divided />
          {personal ? <CountField label="Trial days" name="trial" value={trialCount} onChange={setTrialCount} span /> : null}
        </div>
        <p className="mt-3 text-[12px] font-semibold text-muted">Per month. Checkout charges ×3 for 3 months and ×12 for 1 year.</p>
      </div>
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <SaveButton pending={pending} disabled={pending || !ready} className="mt-4 self-start" />
      <Toast key={toast?.stamp} message={toast?.message ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </form>
  );
}

function PriceReadout({ label, value, divided = false }: { label: string; value: string; divided?: boolean }) {
  return (
    <div className={`grid min-w-0 gap-1 px-3.5 py-3 ${divided ? "border-l border-surface-elevated" : ""}`}>
      <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-[15px] font-semibold text-muted">$</span>
        <span className={`text-[22px] leading-none font-semibold tracking-tight tabular-nums ${value ? "text-ink" : "text-muted"}`}>{value || "—"}</span>
      </span>
    </div>
  );
}

function CountField({ label, name, value, onChange, divided = false, span = false }: { label: string; name: string; value: string; onChange: (value: string) => void; divided?: boolean; span?: boolean }) {
  return (
    <label className={`group relative grid min-w-0 gap-1 border-t border-surface-elevated px-3.5 py-3 ${span ? "col-span-2" : ""} ${divided ? "border-l border-surface-elevated" : ""}`}>
      <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</span>
      <input
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full bg-transparent text-[22px] leading-none font-semibold tracking-tight text-ink tabular-nums outline-none"
      />
      <span className="absolute inset-x-3.5 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform group-focus-within:scale-x-100" />
    </label>
  );
}

function MoneyField({ label, name, value, onChange, divided = false }: { label: string; name: string; value: string; onChange: (value: string) => void; divided?: boolean }) {
  return (
    <label className={`group relative grid min-w-0 gap-1 px-3.5 py-3 ${divided ? "border-l border-surface-elevated" : ""}`}>
      <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-[15px] font-semibold text-muted">$</span>
        <input
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(moneyText(event.target.value))}
          className="w-full bg-transparent text-[22px] leading-none font-semibold tracking-tight text-ink tabular-nums outline-none"
        />
      </span>
      <span className="absolute inset-x-3.5 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform group-focus-within:scale-x-100" />
    </label>
  );
}

function scaledDollars(amount: string, customSeats: string) {
  const cents = customPriceCents(centsFromDollars(amount), Number(customSeats));
  if (cents == null) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

function centsFromDollars(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

function moneyText(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const whole = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  if (dot === -1) return whole;
  return `${whole || "0"}.${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`;
}
