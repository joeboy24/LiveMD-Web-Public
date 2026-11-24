"use client";

import { useActionState, useEffect, useState } from "react";
import { Field } from "../../components/field";
import { SaveButton } from "../../components/save-button";
import { Toast } from "../../components/toast";
import { updateSupportMail } from "../admin/actions";
import { savePassword, saveProfile, type ProfileState } from "./actions";

const initial: ProfileState = { error: null, saved: false, stamp: "" };

export function IdentityForm({ name, email }: { name: string; email: string }) {
  const [nextName, setNextName] = useState(name);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, action, pending] = useActionState(saveProfile, initial);
  useEffect(() => {
    setNextName(name);
  }, [name]);
  const ready = nextName.trim().length > 0 && nextName.trim() !== name;

  useEffect(() => {
    if (!state.saved) return;
    setNotice("Saved.");
  }, [state.saved, state.stamp]);

  return (
    <form action={action} className="mt-4">
      <Field label="Name" name="name" value={nextName} onChange={(event) => setNextName(event.target.value)} autoComplete="name" />
      <Field className="mt-4" label="Email" name="email" type="email" value={email} readOnly />
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

export function SupportMail({ accountId, on }: { accountId: string; on: boolean }) {
  const [checked, setChecked] = useState(on);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "info" } | null>(null);

  async function change(next: boolean) {
    setChecked(next);
    const result = await updateSupportMail(accountId, next);
    if (!result.saved) {
      setChecked(checked);
      setNotice({ message: result.error ?? "Could not save that.", tone: "info" });
      return;
    }
    setNotice({ message: next ? "Support email is on." : "Support email is off.", tone: "success" });
  }

  return (
    <div className="mt-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-background px-3 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => void change(event.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[#076FBF]"
        />
        <span>
          <span className="block text-[14px] font-semibold text-ink">Receive support notifications</span>
          <span className="block text-[13px] leading-5 text-muted">Email when a support message arrives. Every system account still sees it in the app.</span>
        </span>
      </label>
      <Toast message={notice?.message ?? null} tone={notice?.tone} onDone={() => setNotice(null)} />
    </div>
  );
}
