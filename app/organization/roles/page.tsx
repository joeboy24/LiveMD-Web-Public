import { ListRow } from "../../components/list-row";
import { Monogram, PageIntro, SampleMark } from "../chrome";
import { roles, sampleSeats } from "../sample";

export default function RolesPage() {
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="ROLES"
        title="Roles"
        detail="A seat keeps one role. The player sends only the audio that role may hear."
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {roles.map((role) => (
          <li key={role.name} className="rounded-2xl bg-surface p-5">
            <div className="flex items-center gap-2.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
              <h2 className="text-[16px] font-semibold text-ink">{role.name}</h2>
            </div>
            <p className="mt-3 text-[14px] leading-6 text-muted">{role.detail}</p>
            <p className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-muted">AUDIO</p>
            <p className="mt-1 text-[14px] font-semibold text-ink">{role.audio}</p>
          </li>
        ))}
      </ul>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">A sample house</h2>
          <SampleMark />
        </div>
        <ul className="mt-3 grid gap-2">
          {sampleSeats.map((seat) => (
            <li key={seat.name}>
              <ListRow leading={<Monogram name={seat.name} />} title={seat.name} meta={seat.role} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
