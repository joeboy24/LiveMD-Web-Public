"use client";

import { useActionState, useEffect, useState } from "react";
import { FiCheck, FiChevronLeft, FiChevronRight, FiSend, FiX } from "react-icons/fi";
import { listMessageSeats, listSentMessages, sendGroupMessage, type MailSeat, type MessageState, type SentMessage, type SentPage } from "../(main)/organization/message-actions";
import { Field, TextArea } from "./field";
import type { MessageSeat } from "./panel";
import { SaveButton } from "./save-button";
import { Toast } from "./toast";

const initial: MessageState = { error: null, sent: 0, stamp: "", support: false };

export function MessageSheet({
  groupId,
  group,
  recipients,
  support,
}: {
  groupId: string | null;
  group: string | null;
  recipients: MessageSeat[];
  support: boolean;
}) {
  const [refresh, setRefresh] = useState("");
  return (
    <div className="border-t border-surface-elevated px-3 py-3">
      <p className="shrink-0 text-[11px] font-semibold tracking-[0.16em] text-muted">MESSAGE</p>
      <Composer key={support ? "support" : (groupId ?? "seats")} group={group} recipients={recipients} support={support} onSent={setRefresh} />
      <SentList refresh={refresh} />
    </div>
  );
}

function Composer({
  group,
  recipients,
  support,
  onSent,
}: {
  group: string | null;
  recipients: MessageSeat[];
  support: boolean;
  onSent: (stamp: string) => void;
}) {
  const [seats, setSeats] = useState<MailSeat[] | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => recipients.filter((seat) => seat.email).map((seat) => seat.id));
  const [subject, setSubject] = useState(support ? "System Support" : "");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [state, action, pending] = useActionState(sendGroupMessage, initial);
  const ready = subject.trim().length > 0 && body.trim().length > 0 && (support || picked.length > 0);
  const groupIds = recipients.filter((seat) => seat.email).map((seat) => seat.id);
  const sameGroup = Boolean(group) && sameIds(picked, groupIds);
  const needle = query.trim().toLowerCase();
  const shown = (seats ?? []).filter((seat) => seat.name.toLowerCase().includes(needle));
  const chosen = picked.flatMap((id) => {
    const seat = (seats ?? []).find((item) => item.id === id);
    return seat ? [seat] : [];
  });

  useEffect(() => {
    if (support) return;
    let live = true;
    listMessageSeats().then((rows) => {
      if (live) setSeats(rows);
    });
    return () => {
      live = false;
    };
  }, [support]);

  useEffect(() => {
    if (!state.stamp) return;
    setSubject(support ? "System Support" : "");
    setBody("");
    setQuery("");
    setNotice(state.support ? "Sent to support." : state.sent === 1 ? "Sent to 1 seat." : `Sent to ${state.sent} seats.`);
    onSent(state.stamp);
  }, [state.stamp, state.sent, state.support, support, onSent]);

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="label" value={support ? "Support" : sameGroup && group ? group : "Seats"} />
      {support ? <input type="hidden" name="support" value="1" /> : null}
      {support
        ? null
        : picked.map((id) => (
            <input key={id} type="hidden" name="seat" value={id} />
          ))}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">SEATS</p>
        {support ? null : (
          <button
            type="button"
            onClick={() => setPicked([])}
            disabled={picked.length === 0}
            data-help="Remove every seat from this message."
            className="text-[12px] font-semibold text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>
      {support ? (
        <p className="mt-2 inline-flex rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">support</p>
      ) : null}
      {group && !support ? <p className="mt-2 shrink-0 text-[13px] font-semibold text-ink">{group}</p> : null}
      {!support && seats && seats.length === 0 ? <p className="mt-2 shrink-0 text-[13px] leading-5 text-muted">This organization has no seats yet.</p> : null}
      {!support && seats && seats.length > 0 ? (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a seat"
            aria-label="Find a seat"
            data-help="Type a name to show matching seats."
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            className="mt-2 h-9 w-full shrink-0 rounded-xl bg-background px-3 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary-hover"
          />
          {chosen.length > 0 ? (
            <ul className="mt-2 flex shrink-0 flex-wrap gap-1.5">
              {chosen.map((seat) => (
                <li key={seat.id} className="flex items-center gap-1 rounded-full bg-primary py-0.5 pr-0.5 pl-2 text-[11px] font-semibold text-white">
                  <span>{seat.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${seat.name}`}
                    onClick={() => setPicked((current) => current.filter((id) => id !== seat.id))}
                    data-help={`Remove ${seat.name} from this message.`}
                    className="grid size-4 place-items-center rounded-full text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-primary-hover"
                  >
                    <FiX aria-hidden className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {needle ? (
          <ul className="mt-2 rounded-xl bg-background" data-help="Choose the seats that receive this message.">
            {shown.length === 0 ? <li className="px-3 py-3 text-[13px] text-muted">No seats match.</li> : null}
            {shown.map((seat) => {
              const on = picked.includes(seat.id);
              const quiet = !seat.email;
              return (
                <li key={seat.id} className="border-t border-surface-elevated first:border-t-0">
                  <button
                    type="button"
                    disabled={quiet}
                    aria-pressed={on}
                    onClick={() => setPicked((current) => (current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id]))}
                    data-help={quiet ? `${seat.name} has no email, so this seat is left out.` : on ? `Remove ${seat.name} from this message.` : `Add ${seat.name} to this message.`}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-hover disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className={`grid size-4 shrink-0 place-items-center rounded-full border ${on ? "border-primary bg-primary text-white" : "border-muted"}`}>
                      {on ? <FiCheck aria-hidden className="size-3" /> : null}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${quiet ? "text-muted" : "text-ink"}`}>{seat.name}</span>
                    <span className="max-w-[40%] shrink-0 truncate text-[11px] text-muted">{quiet ? "No email" : seat.role}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          ) : null}
        </>
      ) : null}
      <Field
        className="mt-3 shrink-0"
        label="Subject"
        name="subject"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        placeholder="Call time"
        maxLength={120}
        data-help="The subject line of the email."
      />
      <TextArea
        className="mt-3 shrink-0"
        label="Message"
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={support ? "Write to support." : "Write to these seats."}
        rows={5}
        maxLength={2000}
        data-help={support ? "The note the system admins receive." : "The note these seats receive by email."}
      />
      {state.error ? <p className="mt-3 shrink-0 text-sm text-[#e4372d]">{state.error}</p> : null}
      <div className="mt-3 flex shrink-0 justify-end">
        <SaveButton icon={FiSend} pending={pending} pendingLabel="Sending" disabled={pending || !ready} data-help={support ? "Email the system admins." : "Email the chosen seats."}>
          Send
        </SaveButton>
      </div>
      <Toast message={notice} onDone={() => setNotice(null)} />
    </form>
  );
}

function SentList({ refresh }: { refresh: string }) {
  const [page, setPage] = useState(0);
  const [seen, setSeen] = useState(refresh);
  const [data, setData] = useState<SentPage | null>(null);
  if (seen !== refresh) {
    setSeen(refresh);
    setPage(0);
  }

  useEffect(() => {
    let live = true;
    listSentMessages(page).then((result) => {
      if (live) setData(result);
    });
    return () => {
      live = false;
    };
  }, [page, refresh]);

  const messages = data?.messages ?? [];
  const pages = data?.pages ?? 1;

  return (
    <section className="mt-4 border-t border-surface-elevated pt-3" data-help="The last messages sent from this organization.">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">SENT</p>
      {data && messages.length === 0 ? <p className="mt-2 text-[13px] leading-5 text-muted">No messages yet.</p> : null}
      <ul className="mt-2">
        {messages.map((message) => (
          <SentRow key={message.id} message={message} />
        ))}
      </ul>
      {pages > 1 ? (
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Newer messages"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            className="grid size-7 place-items-center rounded-full text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-muted disabled:opacity-40"
          >
            <FiChevronLeft aria-hidden className="size-4" />
          </button>
          <span className="text-[12px] text-muted">{page + 1} of {pages}</span>
          <button
            type="button"
            aria-label="Older messages"
            disabled={page >= pages - 1}
            onClick={() => setPage((current) => current + 1)}
            className="grid size-7 place-items-center rounded-full text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-muted disabled:opacity-40"
          >
            <FiChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SentRow({ message }: { message: SentMessage }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-surface-elevated py-2 first:border-t-0">
      <p className="truncate text-[13px] font-semibold text-ink">{message.subject}</p>
      <p className="truncate text-[12px] text-muted">to {message.recipients.join(", ")}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] text-muted">{message.group} · {sentWhen(message.sentAt)}</p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          data-help={open ? "Hide this message." : "Show this message."}
          className="shrink-0 text-[11px] font-semibold text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          {open ? "Hide" : "View"}
        </button>
      </div>
      {open ? (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-ink">{message.body || "The message text was not kept."}</p>
      ) : null}
    </li>
  );
}

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const sorted = [...right].sort();
  return [...left].sort().every((id, index) => id === sorted[index]);
}

function sentWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
