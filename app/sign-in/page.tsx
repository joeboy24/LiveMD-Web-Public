import { Suspense } from "react";
import { redirect } from "next/navigation";
import { readSessionAccount } from "../auth/queries";
import { SignInForm } from "./sign-in-form";

export default function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  return (
    <Suspense fallback={<p className="px-6 py-8 text-base text-muted">Loading sign in.</p>}>
      <SignInBody searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInBody({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const account = await readSessionAccount();
  if (account) redirect("/");
  const query = await searchParams;
  const expired = query.error === "expired";
  return (
    <div className="mx-auto w-full max-w-md pt-8">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">ACCOUNT</p>
      <h1 className="mt-2 text-[32px] leading-none font-bold tracking-tight text-ink">Sign in</h1>
      <p className="mt-3 text-[15px] leading-6 text-muted">Enter your email. The link signs you in and takes the seat that uses it.</p>
      <section className="mt-6 rounded-2xl bg-surface p-5">
        <SignInForm expired={expired} />
      </section>
    </div>
  );
}
