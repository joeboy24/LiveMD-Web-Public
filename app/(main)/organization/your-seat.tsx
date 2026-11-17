import { readAccess } from "../../auth/access";
import { readSessionAccount } from "../../auth/queries";
import { PageIntro } from "./chrome";
import { readOrganization } from "./queries";
import { roles } from "./sample";

export async function YourSeat() {
  const [access, account, organization] = await Promise.all([readAccess(), readSessionAccount(), readOrganization()]);
  const seat = organization?.seats.find((item) => item.accountId === account?.id) ?? null;
  const role = roles.find((item) => item.name === access.role) ?? null;
  return (
    <div className="grid gap-8">
      <PageIntro
        eyebrow="YOUR SEAT"
        title={seat?.name ?? "Your seat"}
        detail={role?.detail ?? "This seat opens the part of the show it is allowed to use."}
      />
      <section className="max-w-xl rounded-2xl bg-surface p-5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">ROLE</p>
        <p className="mt-1 text-[16px] font-semibold text-ink">{access.role}</p>
        <p className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-muted">AUDIO</p>
        <p className="mt-1 text-[14px] font-semibold text-ink">{role?.audio}</p>
      </section>
    </div>
  );
}
