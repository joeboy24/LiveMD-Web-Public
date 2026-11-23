"use client";

import { useActionState, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { createAccount, signInWithPassword, type SignInState } from "../auth/actions";
import { Field } from "../components/field";

const initial: SignInState = { error: null };

export function SignInForm({ expired, closed = false }: { expired: boolean; closed?: boolean }) {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [signInState, signInAction, signingIn] = useActionState(signInWithPassword, initial);
  const [createState, createAction, creating] = useActionState(createAccount, initial);
  const creatingAccount = mode === "create";
  const pending = creatingAccount ? creating : signingIn;
  const error = creatingAccount ? createState.error : signInState.error;
  const ready = email.trim().length > 0 && password.length > 0 && (!creatingAccount || name.trim().length > 0);

  return (
    <div>
      <div className="grid grid-cols-2 border-b border-surface-elevated" role="group" aria-label="Account">
        <ModeButton selected={!creatingAccount} onClick={() => setMode("sign-in")}>
          Sign in
        </ModeButton>
        <ModeButton selected={creatingAccount} onClick={() => setMode("create")}>
          Create account
        </ModeButton>
      </div>
      <form action={creatingAccount ? createAction : signInAction} className="mt-6 grid gap-3">
        {creatingAccount ? (
          <Field label="Name" name="name" tone="surface" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoFocus />
        ) : null}
        <Field label="Email" name="email" type="email" tone="surface" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoFocus={!creatingAccount} />
        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-muted">Password</span>
          <span className="flex h-12 items-center rounded-xl bg-surface pr-1 focus-within:ring-2 focus-within:ring-primary-hover">
            <input
              name="password"
              type={visible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete={creatingAccount ? "new-password" : "current-password"}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-ink outline-none placeholder:text-muted"
            />
            <button
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible((value) => !value)}
              className="grid size-10 place-items-center rounded-lg text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
            >
              {visible ? <FiEyeOff aria-hidden className="size-4" /> : <FiEye aria-hidden className="size-4" />}
            </button>
          </span>
        </label>
        {expired && !error ? <p className="text-sm text-[#e4372d]">That link has expired. Sign in with your password.</p> : null}
        {error ? <p className="text-sm text-[#e4372d]">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || !ready}
          className="relative mt-3 h-12 overflow-hidden rounded-2xl bg-primary text-[15px] font-bold text-white shadow-[0_10px_24px_rgb(7_111_191/0.38)] outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover disabled:bg-disabled disabled:shadow-none"
        >
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.22),transparent_55%)]" />
          <span className="relative">{pending ? "Please wait" : creatingAccount ? "Create account" : "Sign in"}</span>
        </button>
      </form>
    </div>
  );
}

function ModeButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        selected
          ? "-mb-px border-b-2 border-primary pb-2 text-[14px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          : "-mb-px border-b-2 border-transparent pb-2 text-[14px] font-semibold text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
      }
    >
      {children}
    </button>
  );
}
