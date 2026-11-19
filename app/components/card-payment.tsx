"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type Appearance, type StripeCheckoutElementsSdk, type StripePaymentElement } from "@stripe/stripe-js";
import { FiCreditCard } from "react-icons/fi";

const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishable ? loadStripe(publishable) : null;

export function cardFormReady() {
  return Boolean(stripePromise);
}

export function CardPayment({ clientSecret, onPaid }: { clientSecret: string; onPaid: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeCheckoutElementsSdk | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = mountRef.current;
    if (!node || !stripePromise) return;
    let dead = false;
    let payment: StripePaymentElement | null = null;
    setReady(false);
    void stripePromise.then((stripe) => {
      if (!stripe || dead) return;
      const checkout = stripe.initCheckoutElementsSdk({
        clientSecret,
        elementsOptions: { appearance: cardAppearance(theme) },
      });
      checkoutRef.current = checkout;
      payment = checkout.createPaymentElement({ layout: "tabs" });
      payment.on("ready", () => {
        if (!dead) setReady(true);
      });
      payment.on("loaderror", (event) => {
        if (!dead) setError(event.error.message || "The card form did not open.");
      });
      payment.mount(node);
    });
    return () => {
      dead = true;
      checkoutRef.current = null;
      payment?.unmount();
    };
  }, [clientSecret, theme]);

  async function pay() {
    const checkout = checkoutRef.current;
    if (!checkout) return;
    setPending(true);
    setError(null);
    try {
      const loaded = await checkout.loadActions();
      if (loaded.type === "error") {
        setError(loaded.error.message);
        setPending(false);
        return;
      }
      const result = await loaded.actions.confirm({ redirect: "if_required" });
      if (result.type === "error") {
        setError(result.error.message || "The payment did not go through.");
        setPending(false);
        return;
      }
      onPaid();
    } catch (error) {
      setError(error instanceof Error ? error.message : "The payment did not go through.");
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <div ref={mountRef} className={ready ? "" : "min-h-24 rounded-xl bg-background"} />
      {error ? <p className="mt-3 text-sm text-[#e4372d]">{error}</p> : null}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={!ready || pending}
        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[13px] font-semibold text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover disabled:opacity-50"
      >
        <FiCreditCard aria-hidden className="size-3.5" />
        <span>{pending ? "Paying" : "Pay"}</span>
      </button>
    </div>
  );
}

function cardAppearance(theme: "light" | "dark"): Appearance {
  const dark = theme === "dark";
  return {
    theme: dark ? "night" : "stripe",
    variables: {
      colorPrimary: "#076FBF",
      colorBackground: dark ? "#151D24" : "#FFFFFF",
      colorText: dark ? "#EBEBEA" : "#0B1116",
      colorDanger: "#e4372d",
      borderRadius: "8px",
      labelFontSize: "13px",
    },
    inputs: "condensed",
    rules: {
      ".Label": { fontSize: "13px" },
      ".Input": { borderRadius: "8px" },
      ".Tab": { borderRadius: "8px" },
      ".TabLabel": { fontSize: "13px" },
      ".CheckboxLabel": { fontSize: "13px" },
    },
  };
}
