"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { FiCheck, FiCreditCard, FiEdit2 } from "react-icons/fi";
import { Toast } from "../../../components/toast";
import { chooseFeature, openCheckout, readPanel, readPanelServer, subscribePanel, syncCheckout } from "../../../components/panel";
import { saveCustomSeats } from "../../admin/actions";
import { customPriceCents } from "../sample";
import { choosePlan, type PlanState } from "./actions";

const initial: PlanState = { error: null };

export function PlanButton({
  plan,
  intent,
  terms = [],
  seats,
  currency,
  storage,
  accent,
}: {
  plan: string;
  intent: "upgrade" | "choose";
  terms?: { term: "quarter" | "year"; label: string; cents: number }[];
  seats: number;
  currency: string;
  storage: number | null;
  accent: string;
}) {
  const panel = useSyncExternalStore(subscribePanel, readPanel, readPanelServer);
  const [state, action, pending] = useActionState(choosePlan, initial);
  if (intent === "choose") {
    return (
      <form action={action} className="mt-auto pt-5">
        <input type="hidden" name="plan" value={plan} />
        {state.error ? <p className="mb-3 text-sm text-[#e4372d]">{state.error}</p> : null}
        <TermButton
          type="submit"
          name="term"
          value="year"
          pending={pending}
          label={pending ? "Saving" : "Choose"}
          help={`Use the ${plan} plan.`}
          icon="choose"
          accent={accent}
        />
      </form>
    );
  }
  const open = panel.feature === "checkout" && panel.checkout?.plan === plan;
  return (
    <div className="mt-auto pt-5">
      <UpgradeButton
        pressed={open}
        accent={accent}
        help={`Upgrade to ${plan}.`}
        onClick={() => openCheckout({ plan, terms, currency, seats, storage })}
      />
    </div>
  );
}

export function CustomOffer({
  saved,
  roomQuarter,
  roomYear,
  currency,
  detail,
  owner,
  allowance,
  selected,
  used,
  until,
  held,
  storage,
  accent,
}: {
  saved: string;
  roomQuarter: number | null;
  roomYear: number | null;
  currency: string;
  detail: string;
  owner: boolean;
  allowance: number;
  selected: boolean;
  used: number;
  until: string | null;
  held: boolean;
  storage: number | null;
  accent: string;
}) {
  const [seatCount, setSeatCount] = useState(saved);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "info"; stamp: number } | null>(null);
  const panel = useSyncExternalStore(subscribePanel, readPanel, readPanelServer);
  const typed = Number(seatCount);
  const quarter = customPriceCents(roomQuarter, typed);
  const year = customPriceCents(roomYear, typed);
  const count = Number.isInteger(typed) && typed > 100 ? typed : Number(saved) > 100 ? Number(saved) : 101;
  const intent = owner && count > allowance ? "upgrade" : owner && !held && count < allowance ? "choose" : null;
  const terms = [
    quarter ? { term: "quarter" as const, label: "3 months", cents: quarter } : null,
    year ? { term: "year" as const, label: "1 year", cents: year } : null,
  ].filter((term) => term != null);

  useEffect(() => {
    setSeatCount(saved);
  }, [saved]);

  useEffect(() => {
    if (panel.feature !== "checkout" || panel.checkout?.plan !== "Custom") return;
    const draft = panel.checkout;
    if (!Number.isInteger(typed) || typed <= 100) {
      chooseFeature("checkout");
      return;
    }
    const sameSeats = draft.seats === typed;
    const sameTerms = draft.terms.length === terms.length && draft.terms.every((item, index) => item.term === terms[index]?.term && item.cents === terms[index]?.cents);
    if (sameSeats && sameTerms) return;
    syncCheckout({ plan: "Custom", terms, currency, seats: typed, storage });
  }, [panel.feature, panel.checkout, typed, terms, currency, storage]);

  async function commitSeats() {
    if (seatCount.trim() === saved) return;
    if (!(Number(seatCount) > 100)) {
      setSeatCount(saved);
      setToast({ message: "Custom should be more than 100.", tone: "info", stamp: Date.now() });
      return;
    }
    const result = await saveCustomSeats(seatCount);
    if (!result.saved) {
      setSeatCount(saved);
      setToast({ message: result.error ?? "Custom should be more than 100.", tone: "info", stamp: Date.now() });
      return;
    }
    setToast({ message: "Saved.", tone: "success", stamp: Date.now() });
  }

  async function upgrade() {
    if (!(Number(seatCount) > 100)) {
      setSeatCount(saved);
      setToast({ message: "Custom should be more than 100.", tone: "info", stamp: Date.now() });
      return;
    }
    if (seatCount.trim() !== saved) {
      const result = await saveCustomSeats(seatCount);
      if (!result.saved) {
        setSeatCount(saved);
        setToast({ message: result.error ?? "Custom should be more than 100.", tone: "info", stamp: Date.now() });
        return;
      }
    }
    openCheckout({ plan: "Custom", terms, currency, seats: Number(seatCount), storage });
  }

  return (
    <>
      {owner ? (
        <label className="group mt-4 inline-flex w-fit cursor-text items-end gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="100+"
            aria-label="Seats"
            value={seatCount}
            onChange={(event) => setSeatCount(event.target.value.replace(/\D/g, ""))}
            onBlur={() => void commitSeats()}
            style={{ width: `${Math.max((seatCount || "100+").length, 4) + 0.35}ch` }}
            className="border-b border-dashed border-muted bg-transparent text-[36px] leading-none font-bold tracking-tight text-ink outline-none placeholder:text-ink focus:border-solid focus:border-primary"
          />
          <FiEdit2 aria-hidden className="mb-1 size-3.5 text-muted group-focus-within:text-primary" />
        </label>
      ) : (
        <p className="mt-4 text-[36px] leading-none font-bold tracking-tight text-ink">{seatCount || "100+"}</p>
      )}
      <p className="mt-1 text-[12px] font-semibold tracking-[0.14em] text-muted">{count === 1 ? "SEAT" : "SEATS"}</p>
      <p className="mt-4 text-[14px] leading-6 text-muted">{detail}</p>
      <div className="mt-3 grid gap-1">
        {terms.map((choice) => (
          <p key={choice.term} className="text-[13px] leading-5 text-muted">
            {money(choice.cents, currency)}/m for {choice.label}
          </p>
        ))}
      </div>
      {selected ? (
        <p className="mt-5 text-[12px] text-muted">
          {used} of {count} {count === 1 ? "seat" : "seats"} in use{until ? ` through ${until}` : ""}
        </p>
      ) : null}
      {intent === "choose" ? (
        <PlanButton plan="Custom" intent="choose" seats={count} currency={currency} storage={storage} accent={accent} />
      ) : intent === "upgrade" && terms.length > 0 ? (
        <div className="mt-auto pt-5">
          <UpgradeButton
            pressed={panel.feature === "checkout" && panel.checkout?.plan === "Custom"}
            accent={accent}
            help="Upgrade to Custom."
            onClick={() => void upgrade()}
          />
        </div>
      ) : null}
      <Toast key={toast?.stamp} message={toast?.message ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}

function UpgradeButton({ pressed, accent, help, onClick }: { pressed: boolean; accent: string; help: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-help={help}
      onClick={onClick}
      style={{ background: accent, boxShadow: pressed ? `0 0 0 2px ${accent}` : undefined }}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-white outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <FiCreditCard aria-hidden className="size-3.5" />
      <span>Upgrade</span>
    </button>
  );
}

function TermButton({
  type,
  label,
  help,
  icon,
  pending = false,
  pressed = false,
  name,
  value,
  onClick,
  accent,
}: {
  type: "button" | "submit";
  label: string;
  help: string;
  icon: "upgrade" | "choose";
  pending?: boolean;
  pressed?: boolean;
  name?: string;
  value?: string;
  onClick?: () => void;
  accent?: string;
}) {
  const Icon = icon === "upgrade" ? FiCreditCard : FiCheck;
  return (
    <button
      type={type}
      name={name}
      value={value}
      disabled={pending}
      aria-pressed={type === "button" ? pressed : undefined}
      data-help={help}
      onClick={onClick}
      style={accent ? { background: accent } : undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50 ${accent ? "text-white hover:brightness-110" : "bg-plan-button text-plan-button-ink hover:bg-plan-button-hover focus-visible:ring-primary-hover"}`}
    >
      <Icon aria-hidden className="size-3.5" />
      <span>{label}</span>
    </button>
  );
}

function money(cents: number, currency: string) {
  const amount = cents / 100;
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  if (currency.toLowerCase() === "usd") return `$${value}`;
  return `${value} ${currency.toUpperCase()}`;
}
