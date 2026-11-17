import { Suspense, type ReactNode } from "react";
import { readAccess } from "../../auth/access";
import { OrganizationNav } from "./nav";
import { YourSeat } from "./your-seat";

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="mx-auto mt-8 w-full max-w-3xl text-base text-muted">Loading organization.</p>}>
      <OrganizationFrame>{children}</OrganizationFrame>
    </Suspense>
  );
}

async function OrganizationFrame({ children }: { children: ReactNode }) {
  const access = await readAccess();
  return (
    <div className="mx-auto w-full max-w-3xl">
      {access.organize ? <OrganizationNav /> : null}
      <div className={access.organize ? "mt-8" : ""}>{access.role && !access.organize ? <YourSeat /> : children}</div>
    </div>
  );
}
