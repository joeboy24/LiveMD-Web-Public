"use client";

import { type ReactNode } from "react";
import { RowMenu } from "../components/row-menu";
import { useSetlistHistory } from "./history";
import { SongList } from "./song-list";
import type { Song } from "./types";

export function SongPanel({
  showId,
  title,
  dateLabel,
  ipadUpdate,
  songs,
}: {
  showId: string;
  title: string;
  dateLabel: string;
  ipadUpdate: boolean;
  songs: Song[];
}) {
  const history = useSetlistHistory();

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-[22px] font-bold text-ink">{title}</h2>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {dateLabel} · {songs.length} {songs.length === 1 ? "Song" : "Songs"}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <HeaderButton label="Play" disabled tone={songs.length > 0 ? "primary" : "quiet"}>
            <PlayIcon />
          </HeaderButton>
          <HeaderButton label="Undo" disabled={!history.canUndo} onClick={() => void history.undo()}>
            <UndoIcon />
          </HeaderButton>
          <HeaderButton label="Redo" disabled={!history.canRedo} onClick={() => void history.redo()}>
            <RedoIcon />
          </HeaderButton>
          <RowMenu
            label={`${title} actions`}
            items={[
              { label: ipadUpdate ? "Redownload" : "Download", disabled: !ipadUpdate },
              { label: "Delete", onSelect: () => void history.removeShow(showId, true) },
            ]}
          />
        </div>
      </div>
      <SongList showId={showId} songs={songs} />
    </section>
  );
}

function HeaderButton({
  label,
  disabled,
  tone = "quiet",
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  tone?: "primary" | "quiet";
  onClick?: () => void;
  children: ReactNode;
}) {
  const color = disabled ? (tone === "primary" ? "text-primary" : "text-disabled") : "text-ink";
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${color}`}
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M5 3.1v9.8l7.4-4.9L5 3.1Z" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.2 6.2 3.4 9l2.8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.6 9h5.1a3.2 3.2 0 1 0 0-6.4H7.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.8 6.2 12.6 9 9.8 11.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.4 9H7.3a3.2 3.2 0 1 1 0-6.4H8.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
