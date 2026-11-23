"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiCornerUpLeft, FiSearch, FiSend, FiX } from "react-icons/fi";
import type { SupportTicket } from "../../admin/support";
import { TextArea } from "../../components/field";
import { SaveButton } from "../../components/save-button";
import { Toast } from "../../components/toast";
import { replyToSupport, supportStamp, type ReplyState } from "./support-actions";

const initial: ReplyState = { error: null, saved: false, stamp: "" };

export function SupportList({ tickets }: { tickets: SupportTicket[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [replyId, setReplyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "info"; stamp: number } | null>(null);
  const shown = useMemo(() => tickets.filter((ticket) => matches(ticket, query)), [tickets, query]);
  const open = tickets.find((ticket) => ticket.id === replyId) ?? null;

  useEffect(() => {
    let live = true;
    let ready = false;
    let seen = "";
    async function tick() {
      const stamp = await supportStamp();
      if (!live) return;
      if (!ready) {
        ready = true;
        seen = stamp;
        return;
      }
      if (stamp !== seen) {
        seen = stamp;
        router.refresh();
      }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 4000);
    function incoming() {
      router.refresh();
    }
    window.addEventListener("livemd-notices", incoming);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("livemd-notices", incoming);
    };
  }, [router]);

  return (
    <div className="grid gap-3">
      <label className="relative block max-w-xl">
        <FiSearch aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Organization, name, or message"
          aria-label="Find a support message"
          className="h-12 w-full rounded-xl bg-surface pr-3 pl-10 text-[15px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary-hover"
        />
      </label>
      {shown.length === 0 ? <p className="text-[13px] text-muted">{tickets.length === 0 ? "No support messages yet." : "No messages match."}</p> : null}
      {shown.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-surface-elevated">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr className="text-[11px] font-semibold tracking-[0.16em] text-muted">
                <th className="px-4 py-3 font-semibold">ORG / SEAT</th>
                <th className="px-4 py-3 font-semibold">MESSAGE</th>
                <th className="px-4 py-3 font-semibold">DATE</th>
                <th className="px-4 py-3 font-semibold">STATUS</th>
                <th className="w-14 px-4 py-3"><span className="sr-only">Reply</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((ticket) => (
                <tr key={ticket.id} className="border-t border-surface-elevated">
                  <td className="max-w-[14rem] truncate px-4 py-3 text-[14px] font-semibold text-ink">{ticket.organization} · {ticket.senderName}</td>
                  <td className="max-w-[18rem] truncate px-4 py-3 text-[14px] text-ink">{ticket.body || ticket.subject}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted">{written(ticket.sentAt)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-[13px] font-semibold ${ticket.replies.length > 0 ? "text-[#25C290]" : "text-muted"}`}>
                    {ticket.replies.length > 0 ? "Replied" : "Open"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Reply to ${ticket.senderName}`}
                      onClick={() => setReplyId(ticket.id)}
                      className="grid size-8 place-items-center rounded-lg text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover"
                    >
                      <FiCornerUpLeft aria-hidden className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {open ? <ReplyModal ticket={open} onClose={() => setReplyId(null)} onSent={() => { setReplyId(null); setToast({ message: "Sent.", tone: "success", stamp: Date.now() }); }} /> : null}
      <Toast key={toast?.stamp} message={toast?.message ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </div>
  );
}

function ReplyModal({ ticket, onClose, onSent }: { ticket: SupportTicket; onClose: () => void; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState(replyToSupport, initial);
  const ready = body.trim().length > 0;

  useEffect(() => {
    if (!state.saved) return;
    onSent();
  }, [state.saved, state.stamp, onSent]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={onClose}>
      <form
        action={action}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-reply-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="grid max-h-[85vh] w-full max-w-lg gap-4 overflow-y-auto rounded-2xl bg-surface p-5 shadow-[0_18px_50px_rgb(0_0_0/0.45)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p id="support-reply-title" className="truncate text-[16px] font-semibold text-ink">{ticket.organization} · {ticket.senderName}</p>
            <p className="mt-1 text-[13px] text-muted">{written(ticket.sentAt)}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-background hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <FiX aria-hidden className="size-4" />
          </button>
        </div>
        <p className="whitespace-pre-wrap text-[14px] leading-6 text-ink">{ticket.body || ticket.subject}</p>
        {ticket.replies.length > 0 ? (
          <ul className="grid gap-2">
            {ticket.replies.map((reply) => (
              <li key={reply.id} className="rounded-xl bg-background px-3 py-2.5">
                <p className="text-[12px] text-muted">{reply.author} · {written(reply.sentAt)}</p>
                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-6 text-ink">{reply.body}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <input type="hidden" name="message" value={ticket.id} />
        <TextArea label="Reply" name="body" value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={2000} placeholder="Write a reply." />
        {state.error ? <p className="text-sm text-[#e4372d]">{state.error}</p> : null}
        <SaveButton icon={FiSend} pending={pending} pendingLabel="Sending" disabled={pending || !ready} className="self-start">
          Reply
        </SaveButton>
      </form>
    </div>,
    document.body,
  );
}

function matches(ticket: SupportTicket, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [ticket.organization, ticket.subject, ticket.body, ticket.senderName].some((value) => value.toLowerCase().includes(needle));
}

function written(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
