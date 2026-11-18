import { Suspense } from "react";
import { readAccess } from "../../auth/access";
import { readSessionAccount } from "../../auth/queries";
import { PageIntro } from "../organization/chrome";
import { roles } from "../organization/sample";
import { IdentityForm, PasswordForm } from "./profile-form";

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading profile.</p>}>
      <ProfileBody />
    </Suspense>
  );
}

async function ProfileBody() {
  const [account, access] = await Promise.all([readSessionAccount(), readAccess()]);
  const name = account?.name ?? "";
  const email = account?.email ?? "";
  const role = roles.find((item) => item.name === access.role) ?? null;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageIntro eyebrow="PROFILE" title={name || "Your profile"} detail="Your name and email. The role stays with the seat." />
      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-ink">Account</h2>
          <IdentityForm name={name} email={email} />
        </section>
        <section className="rounded-2xl bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-ink">Password</h2>
          <PasswordForm />
        </section>
      </div>
      {role ? (
        <section className="mt-3 max-w-xl rounded-2xl bg-surface p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">ROLE</p>
          <p className="mt-1 text-[16px] font-semibold text-ink">{role.name}</p>
          <p className="mt-2 text-[14px] leading-6 text-muted">{role.detail}</p>
        </section>
      ) : null}
    </div>
  );
}
