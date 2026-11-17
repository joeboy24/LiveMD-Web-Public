"use client";

import { useActionState, useState } from "react";
import { FiMail } from "react-icons/fi";
import { requestSignIn, type SignInState } from "../auth/actions";
import { Field } from "../components/field";
import { SaveButton } from "../components/save-button";

const initial: SignInState = { error: null, sent: false };

export function SignInForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(requestSignIn, initial);
  if (state.sent) {
    return <p className="text-[15px] leading-6 text-ink">Check your email for a sign-in link. It expires in 15 minutes.</p>;
  }
  return (
    <form action={action}>
      <Field label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoFocus />
      {expired && !state.error ? <p className="mt-3 text-sm text-[#e4372d]">That sign-in link has expired. Request a new one.</p> : null}
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <SaveButton icon={FiMail} pending={pending} pendingLabel="Sending" disabled={pending || email.trim().length === 0} className="mt-4">
        Send link
      </SaveButton>
    </form>
  );
}
