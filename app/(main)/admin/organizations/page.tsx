import { connection } from "next/server";
import { Suspense } from "react";
import { readPlatform } from "../../../admin/platform";
import { PageIntro } from "../../organization/chrome";
import { OrganizationList } from "../organization-list";

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading organizations.</p>}>
      <Organizations />
    </Suspense>
  );
}

async function Organizations() {
  await connection();
  const organizations = await readPlatform();
  const seats = organizations.reduce((count, organization) => count + organization.seats.length, 0);
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="SYSTEM"
        title="Organizations"
        detail="Each account on the platform is an organization, including Personal. Open one to see its seats and payments."
        mark={<span className="rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-ink ring-1 ring-surface-elevated">{organizations.length} · {seats} seats</span>}
      />
      <OrganizationList organizations={organizations} />
    </div>
  );
}
