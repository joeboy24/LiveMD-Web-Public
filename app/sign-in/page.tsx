import { Suspense } from "react";
import { redirect } from "next/navigation";
import { readSessionAccount } from "../auth/queries";
import { SignInAppearance } from "./sign-in-appearance";
import { SignInForm } from "./sign-in-form";

const bars = [18, 34, 52, 28, 64, 40, 72, 26, 48, 36, 58, 22, 44, 30];

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
  const closed = query.error === "closed";
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <SignInAppearance />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#25C290_20%,#38A7E2_50%,#FA8E23_80%,transparent)]" />
      <div className="pointer-events-none absolute top-[-18rem] left-1/2 size-[40rem] -translate-x-1/2 rounded-full border border-primary/15" />
      <div className="pointer-events-none absolute top-[-12rem] left-1/2 size-[28rem] -translate-x-1/2 rounded-full border border-primary/10" />
      <div className="pointer-events-none absolute top-16 left-1/2 size-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[26rem]">
          <Brand />
          <p className="mt-10 text-center text-[12px] font-bold tracking-[0.24em] text-primary-hover">THE ROOM</p>
          <h1 className="mt-3 text-center text-[44px] leading-[0.92] font-bold tracking-tight text-ink sm:text-[56px]">Prepare the show.</h1>
          <div className="mt-8 flex h-28 items-end justify-center gap-2" aria-hidden="true">
            {bars.map((height, index) => (
              <span
                key={height + index}
                className="w-3 rounded-full"
                style={{
                  height: Math.round(height * 1.4),
                  background: index % 3 === 0 ? "#25C290" : index % 3 === 1 ? "#38A7E2" : "#FA8E23",
                  opacity: 0.9,
                }}
              />
            ))}
          </div>
          <p className="mt-4 text-center text-xs leading-6 text-muted">Sign in to open the charts, tems and seats.</p>
          <div className="mt-8">
            <SignInForm expired={expired} closed={closed} />
          </div>
          <p className="mt-8 text-center text-[13px] text-muted">The player stays with the room.</p>
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <span className="relative grid size-11 place-items-center overflow-hidden rounded-2xl bg-primary text-white shadow-[0_10px_24px_rgb(7_111_191/0.4)]">
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.32),transparent_58%)]" />
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
          <path fill="currentColor" d="M1 7h2v2H1zm3-3h2v8H4zm3-2h2v12H7zm3 3h2v6h-2zm3 1h2v4h-2z" />
        </svg>
      </span>
      <span className="text-xl font-bold tracking-tight text-ink">
        Live<span className="pl-0.5 text-primary-hover">MD</span>
      </span>
    </div>
  );
}
