import Link from "next/link";
import { Suspense } from "react";
import { songCountLabel } from "../shows/format";
import { listShows } from "../shows/queries";
import { AreaLinks, PageIntro, Stat } from "./chrome";
import { readSessionAccount } from "../auth/queries";
import { OrganizationForm } from "./organization-form";
import { readOrganization } from "./queries";

export default function OrganizationPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading organization.</p>}>
      <OrganizationBody />
    </Suspense>
  );
}

async function OrganizationBody() {
  const [organization, account] = await Promise.all([readOrganization(), readSessionAccount()]);
  if (!organization) {
    return (
      <div className="grid gap-8">
        <PageIntro
          eyebrow="ORGANIZATION"
          title="Your organization"
          detail="Name it and take the first seat. The shows you publish are the ones the player opens."
        />
        <section className="max-w-xl rounded-2xl bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-ink">Name</h2>
          <OrganizationForm name={null} personName={account?.name ?? null} />
        </section>
        <AreaLinks />
      </div>
    );
  }

  const shows = await listShows();
  const published = shows.filter((show) => show.published);
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="ORGANIZATION"
        title={organization.name}
        detail="Shows for this organization are the ones the player can open."
      />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="SEATS" value={String(organization.seats.length)} />
        <Stat label="SHOWS" value={String(shows.length)} />
        <Stat label="ON THE PLAYER" value={String(published.length)} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-ink">Name</h2>
          <OrganizationForm name={organization.name} />
        </section>
        <section className="rounded-2xl bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-ink">On the player</h2>
          {published.length === 0 ? (
            <p className="mt-3 text-[14px] leading-6 text-muted">A show appears here after it is published.</p>
          ) : (
            <ul className="mt-2 max-h-[8.75rem] overflow-y-auto">
              {published.map((show) => (
                <li key={show.id} className="border-b border-surface-elevated last:border-b-0">
                  <Link
                    href={`/?show=${show.id}`}
                    className="grid h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-1.5 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover"
                  >
                    <span className="truncate text-[12px] leading-none text-muted">{show.title}</span>
                    <span className="text-[12px] leading-none text-muted">
                      {show.dateLabel} · {songCountLabel(show.songCount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
