import { Suspense } from "react";
import { redirect } from "next/navigation";
import { readSessionAccount } from "../auth/queries";
import { AccountBar } from "../components/account-bar";
import { CurrentAccount } from "../components/current-account";
import { IconRail } from "../components/icon-rail";
import { OrganizationLabel } from "../components/organization-header";
import { SiteHeader } from "../components/site-header";
import { SetlistHistory } from "../shows/history";
import { ShowSidebar } from "../shows/show-sidebar";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={null}>
        <RequireAccount />
      </Suspense>
      <SiteHeader
        buttonName={<OrganizationLabel />}
        menuName={<OrganizationLabel />}
        accountBar={
          <Suspense fallback={<AccountBar account={null} buttonName={<OrganizationLabel />} menuName={<OrganizationLabel />} />}>
            <CurrentAccount buttonName={<OrganizationLabel />} menuName={<OrganizationLabel />} />
          </Suspense>
        }
      />
      <SetlistHistory>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[300px_minmax(0,3fr)_minmax(180px,1fr)_3.25rem] md:overflow-hidden">
          <aside className="flex min-h-0 w-full min-w-0 flex-col overflow-x-hidden px-4 pt-4 md:h-full md:overflow-hidden md:border-r md:border-surface-elevated md:px-3 md:py-4">
            <Suspense fallback={<p className="text-base text-muted">Loading shows.</p>}>
              <ShowSidebar />
            </Suspense>
          </aside>
          <main className="flex min-h-0 flex-col overflow-y-auto px-4 py-4 md:overflow-hidden md:px-6">{children}</main>
          <aside aria-label="Chat and todos" className="hidden min-h-0 border-l border-surface-elevated md:block" />
          <IconRail />
        </div>
      </SetlistHistory>
    </div>
  );
}

async function RequireAccount() {
  const account = await readSessionAccount();
  if (!account) redirect("/sign-in");
  return null;
}
