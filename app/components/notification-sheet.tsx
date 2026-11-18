"use client";

import { useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { listNotifications, openNotification, type Notice, type NoticePage } from "../(main)/organization/notification-actions";
import { setNoticeCount } from "./notice-count";

export function NotificationSheet() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NoticePage | null>(null);

  useEffect(() => {
    let live = true;
    listNotifications(page).then((result) => {
      if (!live) return;
      setData(result);
      setNoticeCount(result.mark);
    });
    return () => {
      live = false;
    };
  }, [page]);

  const notices = data?.notices ?? [];
  const pages = data?.pages ?? 1;

  return (
    <div className="border-t border-surface-elevated px-3 py-3">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">NOTIFICATIONS</p>
      {data && notices.length === 0 ? <p className="mt-2 text-[13px] leading-5 text-muted">No alerts yet.</p> : null}
      <ul className="mt-2">
        {notices.map((notice) => (
          <NoticeRow key={notice.id} notice={notice} />
        ))}
      </ul>
      {pages > 1 ? (
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Newer alerts"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            className="grid size-7 place-items-center rounded-full text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-muted disabled:opacity-40"
          >
            <FiChevronLeft aria-hidden className="size-4" />
          </button>
          <span className="text-[12px] text-muted">{page + 1} of {pages}</span>
          <button
            type="button"
            aria-label="Older alerts"
            disabled={page >= pages - 1}
            onClick={() => setPage((current) => current + 1)}
            className="grid size-7 place-items-center rounded-full text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-muted disabled:opacity-40"
          >
            <FiChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NoticeRow({ notice }: { notice: Notice }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(notice.read);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || read) return;
    setRead(true);
    void openNotification(notice.id).then(setNoticeCount);
  }

  return (
    <li className="border-t border-surface-elevated py-2 first:border-t-0">
      <p className="flex items-center gap-1.5">
        {read ? null : <span className={`size-1.5 shrink-0 rounded-full ${notice.label === "System" ? "bg-[#e85d4c]" : "bg-[#25C290]"}`} />}
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{notice.title}</span>
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] text-muted">{notice.label} · {sentWhen(notice.sentAt)}</p>
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          data-help={open ? "Hide this alert." : "Show this alert."}
          className="shrink-0 text-[11px] font-semibold text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          {open ? "Hide" : "View"}
        </button>
      </div>
      {open ? <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-ink">{notice.body}</p> : null}
    </li>
  );
}

function sentWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
