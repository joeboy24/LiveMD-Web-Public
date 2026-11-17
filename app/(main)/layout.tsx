import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { readAccess } from "../auth/access";
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
    <Suspense fallback={<p className="px-6 py-8 text-base text-muted">Loading.</p>}>
      <MainShell>{children}</MainShell>
    </Suspense>
  );
}

async function MainShell({ children }: { children: ReactNode }) {
  const account = await readSessionAccount();
  if (!account) redirect("/sign-in");
  const access = await readAccess();
  if (!access.web) return <PlayerSeat />;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
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

function PlayerSeat() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-surface-elevated bg-surface px-4 py-3.5">
        <span className="text-lg font-bold tracking-tight text-ink">
          Live<span className="pl-0.5 text-primary-hover">MD</span>
        </span>
        <Suspense fallback={<AccountBar account={null} buttonName={<OrganizationLabel />} menuName={<OrganizationLabel />} />}>
          <CurrentAccount buttonName={<OrganizationLabel />} menuName={<OrganizationLabel />} />
        </Suspense>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">YOUR SEAT</p>
          <h1 className="mt-2 text-[32px] leading-none font-bold tracking-tight text-ink">Playback operator</h1>
          <p className="mt-3 text-[15px] leading-6 text-muted">This seat plays the published show on the iPad. It doesn't use the website.</p>
        </div>
      </main>
    </div>
  );
}
