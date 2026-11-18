"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { FiMessageSquare, FiPlus } from "react-icons/fi";
import { Field } from "../../components/field";
import { SaveButton } from "../../components/save-button";
import { openMessage, readPanel, readPanelServer, subscribePanel } from "../../components/panel";
import { createGroup, removeGroup, renameGroup, setGroupSeat, type GroupState } from "./group-actions";
import type { SeatGroup, SeatRecord } from "./queries";

const initialState: GroupState = { error: null };

export function GroupBoard({ groups, seats }: { groups: SeatGroup[]; seats: SeatRecord[] }) {
  return (
    <div className="grid gap-4">
      <CreateGroup />
      {groups.length === 0 ? (
        <p className="text-[14px] leading-6 text-muted">A group can be a band, a vocal team, or the people who play one service.</p>
      ) : (
        groups.map((group) => <GroupCard key={group.id} group={group} seats={seats} />)
      )}
    </div>
  );
}

function CreateGroup() {
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState(async (previous: GroupState, formData: FormData) => {
    const result = await createGroup(previous, formData);
    if (!result.error) setName("");
    return result;
  }, initialState);

  return (
    <form action={action} className="rounded-2xl bg-surface p-4">
      <Field
        label="Group name"
        name="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="ex. Vocals"
        data-help="Name a group of seats."
        autoFocus
      />
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <SaveButton icon={FiPlus} pending={pending} pendingLabel="Saving" disabled={pending || name.trim().length === 0} className="mt-4">
        Add group
      </SaveButton>
    </form>
  );
}

function GroupCard({ group, seats }: { group: SeatGroup; seats: SeatRecord[] }) {
  const panel = useSyncExternalStore(subscribePanel, readPanel, readPanelServer);
  const [name, setName] = useState(group.name);
  const [members, setMembers] = useState(group.seatIds);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const open = panel.feature === "message" && panel.groupId === group.id;
  const people = seats.filter((seat) => members.includes(seat.id));

  function commitName() {
    const next = name.trim();
    if (!next || next === group.name) {
      setName(group.name);
      return;
    }
    setName(next);
    start(() => {
      void renameGroup(group.id, next);
    });
  }

  function toggle(seat: SeatRecord) {
    const member = members.includes(seat.id);
    setMembers(member ? members.filter((id) => id !== seat.id) : [...members, seat.id]);
    start(async () => {
      const error = await setGroupSeat(group.id, seat.id, !member);
      if (error) setMembers(member ? [...members, seat.id] : members.filter((id) => id !== seat.id));
    });
  }

  return (
    <article className="rounded-2xl bg-surface p-4">
      <div className="flex items-center gap-2">
        <input
          value={name}
          aria-label="Group name"
          data-help="Rename this group."
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setName(group.name);
              event.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-ink outline-none"
        />
        <SaveButton
          type="button"
          icon={FiMessageSquare}
          aria-pressed={open}
          data-help="Open a message to the seats in this group."
          onClick={() =>
            openMessage(
              group.id,
              group.name,
              people.map((seat) => ({ id: seat.id, name: seat.name, email: seat.email, role: seat.role })),
            )
          }
          className={open ? "ring-2 ring-primary-hover" : ""}
        >
          Message
        </SaveButton>
      </div>
      <p className="mt-1 text-[12px] text-muted">{people.length === 1 ? "1 seat" : `${people.length} seats`}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {seats.map((seat) => {
          const on = members.includes(seat.id);
          return (
            <li key={seat.id}>
              <button
                type="button"
                aria-pressed={on}
                data-help={`${seat.role}. Add or remove this seat from the group.`}
                onClick={() => toggle(seat)}
                className={`rounded-full px-3 py-1 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${on ? "bg-primary text-white" : "bg-background text-muted hover:text-ink"}`}
              >
                {seat.name}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            start(() => {
              void removeGroup(group.id);
            });
          }}
          className="text-[13px] font-semibold text-muted outline-none hover:text-[#e4372d] focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          {confirming ? "Remove this group" : "Remove"}
        </button>
      </div>
    </article>
  );
}
