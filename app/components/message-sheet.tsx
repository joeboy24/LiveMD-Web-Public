"use client";

import type { MessageSeat } from "./panel";

export function MessageSheet({ group, recipients }: { group: string | null; recipients: MessageSeat[] }) {
  return (
    <div className="border-t border-surface-elevated px-3 py-3">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">MESSAGE</p>
      {recipients.length === 0 ? (
        <p className="mt-2 text-[13px] leading-5 text-muted">
          {group ? `${group} has no seats yet.` : "Open a group and use its message icon. Those seats are the recipients."}
        </p>
      ) : (
        <>
          <p className="mt-2 text-[13px] font-semibold text-ink">{group}</p>
          <ul className="mt-1">
            {recipients.map((seat) => (
              <li key={seat.id} className="flex items-baseline justify-between gap-3 border-t border-surface-elevated py-2 first:border-t-0">
                <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{seat.name}</span>
                <span className="shrink-0 text-[12px] text-muted">{seat.role}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
