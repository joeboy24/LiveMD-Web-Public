"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { DateMark } from "../components/date-mark";
import { EmptyLabel } from "../components/empty-label";
import { Field } from "../components/field";
import { ListRow } from "../components/list-row";
import { Modal } from "../components/modal";
import { PrimaryButton } from "../components/primary-button";
import { MonthCalendar } from "../components/month-calendar";
import { RowMenu } from "../components/row-menu";
import { SearchField } from "../components/search-field";
import { createShow, updateShow } from "./actions";
import { useSetlistHistory } from "./history";
import { downloadPublished } from "./publication";
import { songCountLabel } from "./format";
import type { FormState, Show } from "./types";

const initialState: FormState = { error: null };

function emptyCopy(showCount: number, day: string | null, filteringQuery: boolean) {
  if (showCount === 0) return "No shows yet.";
  if (day && !filteringQuery) {
    return (
      <>
        No shows on <span className="font-semibold text-ink">{dayPhrase(day)}</span>.
      </>
    );
  }
  return "No matches.";
}

function dayPhrase(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function ShowBrowser({ shows }: { shows: Show[] }) {
  const router = useRouter();
  const history = useSetlistHistory();
  const selectedId = useSearchParams().get("show");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Show | null>(null);
  const [day, setDay] = useState<string | null>(null);

  function onSearch(next: string) {
    setQuery(next);
    setDay(null);
  }
  const trimmed = query.trim().toLowerCase();
  const onDay = day ? shows.filter((show) => show.dateKey === day) : shows;
  const visible = trimmed ? onDay.filter((show) => show.title.toLowerCase().includes(trimmed)) : onDay;

  function chooseDate(dateKey: string) {
    if (dateKey === day) {
      setDay(null);
      return;
    }
    setDay(dateKey);
    const matches = shows.filter((show) => show.dateKey === dateKey);
    if (matches.length === 1) {
      router.push(`/?show=${matches[0].id}`);
      return;
    }
    if (selectedId && !matches.some((show) => show.id === selectedId)) router.push("/");
  }

  return (
    <section className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[17px] font-bold text-ink">Shows</h1>
        <button
          type="button"
          data-help="Start a show with a name and a performance date."
          onClick={() => setAdding(true)}
          className="rounded-lg text-[13px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          Add Setlist
        </button>
      </div>
      <div className="mt-1">
        <SearchField value={query} onChange={onSearch} label="Search shows" placeholder="Search shows" />
      </div>
      {visible.length === 0 ? (
        <EmptyLabel className="mt-3">{emptyCopy(shows.length, day, Boolean(trimmed))}</EmptyLabel>
      ) : (
        <ul className="mt-3 grid min-w-0 gap-2">
          {visible.map((show) => (
            <li key={show.id} className="min-w-0">
              <ListRow
                href={`/?show=${show.id}`}
                selected={show.id === selectedId}
                leading={<DateMark month={show.month} day={show.day} />}
                title={show.title}
                meta={songCountLabel(show.songCount)}
                trailing={
                  <RowMenu
                    label={`${show.title} actions`}
                    items={[
                      { label: "Edit", onSelect: () => setEditing(show) },
                      {
                        label: "Download",
                        disabled: !show.published,
                        onSelect: () => downloadPublished(show.id),
                      },
                      {
                        label: "Delete",
                        onSelect: () => {
                          void history.removeShow(show.id, show.id === selectedId);
                        },
                      },
                    ]}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
      </div>
      <MonthCalendar
        showDates={shows.map((show) => show.dateKey)}
        selectedDate={day}
        onSelectDate={chooseDate}
        canClear={Boolean(day) || Boolean(trimmed)}
        onClear={() => {
          setDay(null);
          setQuery("");
        }}
      />
      {adding ? <SetlistDialog onClose={() => setAdding(false)} /> : null}
      {editing ? <SetlistDialog key={editing.id} show={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function SetlistDialog({ show, onClose }: { show?: Show; onClose: () => void }) {
  const router = useRouter();
  const history = useSetlistHistory();
  const [name, setName] = useState(show?.title ?? "");
  const [performedOn, setPerformedOn] = useState(show?.dateKey ?? todayKey());
  const [state, formAction, pending] = useActionState(async (previous: FormState, formData: FormData) => {
    const title = String(formData.get("title") ?? "").trim();
    const date = String(formData.get("performedOn") ?? "").trim();
    if (show && title === show.title && date === show.dateKey) {
      onClose();
      return { error: null };
    }
    const result = show ? await updateShow(show.id, previous, formData) : await createShow(previous, formData);
    if (show && result.saved) {
      history.record({
        kind: "edit-show",
        before: { id: show.id, title: show.title, performedOn: show.dateKey },
        after: { id: show.id, title, performedOn: date },
      });
      onClose();
    }
    if (result.show) {
      history.record({ kind: "add-show", show: result.show, reopen: true });
      onClose();
      router.push(`/?show=${result.show.id}`);
    }
    return result;
  }, initialState);
  const ready = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(performedOn);

  return (
    <Modal title={show ? "Edit Show" : "Add Setlist"} onClose={onClose}>
      <form action={formAction}>
        <Field
          className="mt-4"
          label="Show Name"
          name="title"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="ex. Funkadelphi 2026"
          autoFocus
        />
        <Field
          className="mt-4"
          label="Performance date"
          name="performedOn"
          type="date"
          value={performedOn}
          onChange={(event) => setPerformedOn(event.target.value)}
          required
        />
        {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
        <PrimaryButton type="submit" disabled={pending || !ready} className="mt-4 w-full">
          {pending ? "Saving…" : show ? "Save" : "Add Setlist"}
        </PrimaryButton>
      </form>
    </Modal>
  );
}
