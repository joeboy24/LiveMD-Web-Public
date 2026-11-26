"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FiMail } from "react-icons/fi";
import { Field } from "../../components/field";
import { ListRow } from "../../components/list-row";
import { SaveButton } from "../../components/save-button";
import { Toast, type ToastTone } from "../../components/toast";
import { RowMenu } from "../../components/row-menu";
import { Monogram } from "./chrome";
import { roles } from "./sample";
import { addSeat, reinviteSeat, removeSeat, renameSeat, restoreSeat, type OrganizationState } from "./actions";

type SeatRecord = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  invited: boolean;
  disabled: boolean;
};

const initial: OrganizationState = { error: null };

export function SeatBoard({ seats, seatAllowance }: { seats: SeatRecord[]; seatAllowance: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: ToastTone; id: number } | null>(null);
  const [state, action, pending] = useActionState(async (previous: OrganizationState, formData: FormData) => {
    const result = await addSeat(previous, formData);
    if (result.saved || !result.error) {
      setName("");
      setEmail("");
      setRole("");
      if (!result.error) {
        setNotice({
          text: result.sent ? "Invitation sent." : "Seat saved. No email was sent.",
          tone: result.sent ? "success" : "info",
          id: Date.now(),
        });
      }
      router.refresh();
    }
    return result;
  }, initial);

  const active = seats.filter((seat) => !seat.disabled);
  const count = active.length === 1 ? "1 seat" : `${active.length} seats`;
  const full = active.length >= seatAllowance;
  const ready = name.trim().length > 0 && email.trim().length > 0 && role.length > 0;
  const allowanceLabel = seatAllowance === 1 ? "1 seat" : `${seatAllowance} seats`;

  function attemptAdd(event: FormEvent<HTMLFormElement>) {
    if (!full) return;
    event.preventDefault();
    router.push("/organization/plan");
  }

  return (
    <div>
      {notice ? <Toast key={notice.id} message={notice.text} tone={notice.tone} onDone={() => setNotice(null)} /> : null}
      <form action={action} onSubmit={attemptAdd} className="rounded-2xl bg-surface p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
          <Field label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
        </div>
        <RoleField className="mt-3" value={role} onChange={setRole} />
        {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
        <p className="mt-4 text-[13px] text-muted">This plan includes {allowanceLabel}.</p>
        <SaveButton icon={FiMail} pending={pending} pendingLabel="Inviting" disabled={pending || (!full && !ready)} className="mt-4">
          {full ? "Choose a plan" : "Invite"}
        </SaveButton>
      </form>
      <p className="mt-5 text-[13px] font-semibold text-muted">{count}</p>
      <ul className="mt-3 grid gap-2">
        {seats.map((seat) => (
          <li key={seat.id}>
            {editing === seat.id ? (
              <RenameSeat
                seat={seat}
                onDone={() => {
                  setEditing(null);
                  setError(null);
                  router.refresh();
                }}
                onError={setError}
              />
            ) : (
              <ListRow
                quiet={seat.disabled}
                leading={<Monogram name={seat.name} />}
                title={seat.name}
                meta={seatMeta(seat)}
                trailing={
                  <RowMenu
                    label={`${seat.name} actions`}
                    items={[
                      { label: "Edit", onSelect: () => setEditing(seat.id) },
                      ...(seat.invited && !seat.disabled
                        ? [{
                            label: "Invite again",
                            onSelect: () => {
                              void reinviteSeat(seat.id).then(
                                (result) => {
                                  setError(null);
                                  setNotice({
                                    text: result.error ?? (result.sent ? "Invitation sent." : "Invitation refreshed. No email was sent."),
                                    tone: result.error ? "warning" : result.sent ? "success" : "info",
                                    id: Date.now(),
                                  });
                                },
                                () => {
                                  setNotice({ text: "The invitation could not be sent again.", tone: "warning", id: Date.now() });
                                },
                              );
                            },
                          }]
                        : []),
                      seat.disabled
                        ? {
                            label: "Restore",
                            onSelect: () => {
                              if (active.length >= seatAllowance) {
                                setNotice({ text: "This plan is full. Restore needs an open seat.", tone: "warning", id: Date.now() });
                                return;
                              }
                              void restoreSeat(seat.id).then((result) => {
                                if (result.error) {
                                  setNotice({ text: result.error, tone: "warning", id: Date.now() });
                                  return;
                                }
                                router.refresh();
                              });
                            },
                          }
                        : {
                            label: "Remove",
                            disabled: seat.role === "Owner",
                            onSelect: () => {
                              if (seat.role === "Owner") return;
                              void removeSeat(seat.id).then((result) => {
                                if (result.error) {
                                  setNotice({ text: result.error, tone: "warning", id: Date.now() });
                                  return;
                                }
                                router.refresh();
                              });
                            },
                          },
                    ]}
                  />
                }
              />
            )}
          </li>
        ))}
      </ul>
      {error ? <p className="mt-3 text-sm text-[#e4372d]">{error}</p> : null}
    </div>
  );
}

function seatMeta(seat: SeatRecord) {
  return [seat.role, seat.email, seat.invited ? "Invited" : "", seat.disabled ? "Disabled" : ""].filter(Boolean).join(" · ");
}

function RoleField({ value, onChange, className = "", locked = false }: { value: string; onChange: (role: string) => void; className?: string; locked?: boolean }) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-[13px] font-semibold text-muted">Role</span>
      {locked ? <input type="hidden" name="role" value={value} /> : null}
      <select
        name={locked ? undefined : "role"}
        value={value}
        disabled={locked}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-xl bg-background px-3 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-muted"
      >
        <option value="">Choose a role</option>
        {roles.map((role) => (
          <option key={role.name} value={role.name}>
            {role.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function RenameSeat({
  seat,
  onDone,
  onError,
}: {
  seat: SeatRecord;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(seat.name);
  const [email, setEmail] = useState(seat.email ?? "");
  const [role, setRole] = useState(seat.role);
  const [state, action, pending] = useActionState(async (previous: OrganizationState, formData: FormData) => {
    const result = await renameSeat(seat.id, previous, formData);
    if (result.error) onError(result.error);
    else onDone();
    return result;
  }, initial);
  return (
    <form action={action} className="grid gap-2 rounded-xl bg-surface p-3">
      <Field label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      <Field label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
      <RoleField value={role} onChange={setRole} locked={seat.role === "Owner"} />
      {state.error ? <p className="text-sm text-[#e4372d]">{state.error}</p> : null}
      <SaveButton pending={pending} disabled={pending || name.trim().length === 0 || role.length === 0 || (seat.invited && email.trim().length === 0)} />
    </form>
  );
}
