import { connection } from "next/server";
import { Suspense } from "react";
import { readDiscounts } from "../../organization/billing";
import { PageIntro } from "../../organization/chrome";
import { DiscountForm } from "../discount-form";

export default function DiscountsPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading discounts.</p>}>
      <Discounts />
    </Suspense>
  );
}

async function Discounts() {
  await connection();
  const discounts = await readDiscounts();
  return (
    <div className="grid gap-8">
      <PageIntro eyebrow="SYSTEM" title="Discounts" detail="A code is up to 7 letters and numbers. Take a percent off, or a dollar amount off." />
      <DiscountForm discounts={discounts} />
    </div>
  );
}
