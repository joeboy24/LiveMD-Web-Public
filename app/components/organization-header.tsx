import { Suspense } from "react";
import { readOrganization } from "../organization/queries";

export function OrganizationLabel() {
  return (
    <Suspense fallback={<span className="max-w-40 truncate">Organization</span>}>
      <OrganizationName />
    </Suspense>
  );
}

async function OrganizationName() {
  const organization = await readOrganization();
  return <span className="max-w-40 truncate">{organization?.name ?? "Organization"}</span>;
}
