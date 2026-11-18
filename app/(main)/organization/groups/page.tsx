import Link from "next/link";
import { Suspense } from "react";
import { PageIntro, SampleMark } from "../chrome";
import { GroupBoard } from "../group-board";
import { listGroups, readOrganization } from "../queries";

export default function GroupsPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading groups.</p>}>
      <GroupsBody />
    </Suspense>
  );
}

async function GroupsBody() {
  const organization = await readOrganization();
  if (!organization) {
    return (
      <div className="grid gap-8">
        <PageIntro
          eyebrow="GROUPS"
          title="Groups"
          detail="A sample of how seats gather. Name the organization to keep groups of your own."
          mark={<SampleMark />}
        />
        <p className="text-[14px] text-muted">
          <Link href="/organization" className="font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover">
            Name the organization
          </Link>
        </p>
      </div>
    );
  }

  const groups = await listGroups();
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="GROUPS"
        title="Groups"
        detail={`${organization.name}. Gather seats, message that group, or limit a show to it.`}
      />
      <GroupBoard groups={groups} seats={organization.seats} />
    </div>
  );
}
