"use client";

import { useActionState, useEffect, useState } from "react";
import { Field } from "../../components/field";
import { SaveButton } from "../../components/save-button";
import { Toast } from "../../components/toast";
import { savePassword, saveProfile, type ProfileState } from "./actions";

const initial: ProfileState = { error: null, saved: false, stamp: "" };

export function IdentityForm({ name, email }: { name: string; email: string }) {
  const [nextName, setNextName] = useState(name);
  const [nextEmail, setNextEmail] = useState(email);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [state, action, pending] = useActionState(saveProfile, initial);
  useEffect(() => {
    setNextName(name);
    setNextEmail(email);
  }, [name, email]);
  const emailChanged = nextEmail.trim().toLowerCase() !== email.toLowerCase();
  const changed = nextName.trim() !== name || emailChanged;
  const ready = nextName.trim().length > 0 && nextEmail.trim().length > 0 && changed && (!emailChanged || password.length > 0);

  useEffect(() => {
    if (!state.saved) return;
    setNotice("Saved.");
    setPassword("");
  }, [state.saved, state.stamp]);

  return (
    <form action={action} className="mt-4">
      <Field label="Name" name="name" value={nextName} onChange={(event) => setNextName(event.target.value)} autoComplete="name" />
      <Field className="mt-4" label="Email" name="email" type="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} autoComplete="email" />
      {emailChanged ? (
        <Field
          className="mt-4"
          label="Current password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      ) : (
        <input type="hidden" name="password" value="" />
      )}
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <SaveButton pending={pending} disabled={pending || !ready} className="mt-4" />
      <Toast message={notice} onDone={() => setNotice(null)} />
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [state, action, pending] = useActionState(savePassword, initial);
  const ready = current.length > 0 && next.length >= 8;

  useEffect(() => {
    if (!state.saved) return;
    setNotice("Password saved.");
    setCurrent("");
    setNext("");
  }, [state.saved, state.stamp]);

  return (
    <form action={action} className="mt-4">
      <Field label="Current password" name="current" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" />
      <Field className="mt-4" label="New password" name="next" type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" />
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <SaveButton pending={pending} disabled={pending || !ready} className="mt-4" />
      <Toast message={notice} onDone={() => setNotice(null)} />
    </form>
  );
}
