"use client";

import { useActionState, useState } from "react";
import { Field } from "../../components/field";
import { SaveButton } from "../../components/save-button";
import { createOrganization, renameOrganization, type OrganizationState } from "./actions";

const initial: OrganizationState = { error: null };

export function OrganizationForm({
  name,
  personName = null,
}: {
  name: string | null;
  /** First seat. Filled from the signed-in user when an account exists, and still editable. */
  personName?: string | null;
}) {
  if (name === null) return <CreateOrganization personName={personName} />;
  return <RenameOrganization name={name} />;
}

function CreateOrganization({ personName }: { personName: string | null }) {
  const [name, setName] = useState("");
  const [seat, setSeat] = useState(personName ?? "");
  const [state, action, pending] = useActionState(createOrganization, initial);
  const ready = name.trim().length > 0 && seat.trim().length > 0;
  return (
    <form action={action} className="mt-4">
      <Field label="Organization name" name="name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      <Field className="mt-4" label="Your name" name="seat" value={seat} onChange={(event) => setSeat(event.target.value)} />
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <SaveButton pending={pending} disabled={pending || !ready} className="mt-4" />
    </form>
  );
}

function RenameOrganization({ name: current }: { name: string }) {
  const [name, setName] = useState(current);
  const [state, action, pending] = useActionState(renameOrganization, initial);
  const ready = name.trim().length > 0 && name.trim() !== current;
  return (
    <form action={action} className="mt-4">
      <Field label="Organization name" name="name" value={name} onChange={(event) => setName(event.target.value)} />
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <SaveButton pending={pending} disabled={pending || !ready} className="mt-4" />
    </form>
  );
}
