import { connection } from "next/server";
import { Suspense } from "react";
import { readSupportTickets } from "../../../admin/support";
import { PageIntro } from "../../organization/chrome";
import { SupportList } from "@/app/(main)/admin/support-list";

export default function SupportPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading support.</p>}>
      <Support />
    </Suspense>
  );
}

async function Support() {
  await connection();
  const tickets = await readSupportTickets();
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="SYSTEM"
        title="Support"
        detail="Messages sent to support. Open one reply directly"
        mark={<span className="rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-ink ring-1 ring-surface-elevated">{tickets.length} {tickets.length === 1 ? "message" : "messages"}</span>}
      />
      <SupportList tickets={tickets} />
    </div>
  );
}
