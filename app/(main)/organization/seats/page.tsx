import Link from "next/link";
import { Suspense } from "react";
import { ListRow } from "../../../components/list-row";
import { Monogram, PageIntro, SampleMark } from "../chrome";
import { livePlan, readSeatAllowance } from "../billing";
import { sampleSeats } from "../sample";
import { SeatBoard } from "../seat-board";
import { readOrganization } from "../queries";

export default function SeatsPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading seats.</p>}>
      <SeatsBody />
    </Suspense>
  );
}

async function SeatsBody() {
  const organization = await readOrganization();
  if (!organization) {
    return (
      <div className="grid gap-8">
        <PageIntro
          eyebrow="SEATS"
          title="Seats"
          detail="A sample roster. Name the organization to keep the people who can open the player."
          mark={<SampleMark />}
        />
        <ul className="grid gap-2">
          {sampleSeats.map((seat) => (
            <li key={seat.name}>
              <ListRow leading={<Monogram name={seat.name} />} title={seat.name} meta={seat.role} />
            </li>
          ))}
        </ul>
        <p className="text-[14px] text-muted">
          <Link href="/organization" className="font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover">
            Name the organization
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="SEATS"
        title="Seats"
        detail={`${organization.name}. Invite someone with a name, an email, and a role. They take the seat when they accept.`}
      />
      <SeatBoard seats={organization.seats} seatAllowance={await readSeatAllowance(livePlan(organization.plan, organization.planUntil))} />
    </div>
  );
}
