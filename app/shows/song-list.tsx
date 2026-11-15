"use client";

import { useEffect, useState } from "react";
import { Modal } from "../components/modal";
import { RowMenu } from "../components/row-menu";
import { createSong } from "./actions";
import { useSetlistHistory } from "./history";
import { songLine } from "./format";
import { SongForm } from "./song-form";
import type { useSetlistPlayback } from "./setlist-playback";
import type { Song } from "./types";

type Playback = ReturnType<typeof useSetlistPlayback>;

export function SongList({
  showId,
  songs,
  onArrange,
  playback,
}: {
  showId: string;
  songs: Song[];
  onArrange: (songId: string) => void;
  playback: Playback;
}) {
  const history = useSetlistHistory();
  const [adding, setAdding] = useState(false);
  const [rows, setRows] = useState(songs);
  const [dragged, setDragged] = useState<string | null>(null);
  useEffect(() => setRows(songs), [songs]);

  function place(songId: string, target: number) {
    const from = rows.findIndex((song) => song.id === songId);
    if (from < 0 || target < 0 || target >= rows.length || target === from) return;
    const next = rows.slice();
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    setRows(next);
    void history.moveSongs(showId, rows.map((song) => song.id), next.map((song) => song.id));
  }

  return (
    <>
      <ul className="mt-4 grid gap-2">
        {rows.map((song, index) => (
          <li
            key={song.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const songId = event.dataTransfer.getData("text/plain");
              setDragged(null);
              place(songId, index);
            }}
            className={`flex h-16 items-center gap-3 rounded-xl bg-surface px-3 ${dragged === song.id ? "opacity-50" : ""}`}
          >
            {rows.length > 1 ? (
              <button
                type="button"
                draggable
                aria-label={`Reorder ${song.title}`}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", song.id);
                  event.dataTransfer.effectAllowed = "move";
                  setDragged(song.id);
                }}
                onDragEnd={() => setDragged(null)}
                className="grid size-6 shrink-0 cursor-grab place-items-center text-muted active:cursor-grabbing"
              >
                <GripIcon />
              </button>
            ) : null}
            <span className="w-[18px] shrink-0 text-[15px] font-semibold text-muted">{index + 1}</span>
            {playback.activeId === song.id ? <ProgressMark progress={playback.progress} /> : <NoteMark />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold text-ink">{song.title}</span>
              <span className="mt-0.5 block truncate text-[13px] text-muted">{songLine(song)}</span>
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={playback.activeId === song.id && playback.playing ? `Pause ${song.title}` : `Play ${song.title}`}
                disabled={!song.stemKey}
                onClick={() => playback.toggleSong(song.id)}
                className="grid size-8 place-items-center rounded-full bg-primary text-white shadow-[0_4px_12px_rgb(7_111_191/0.4)] outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover disabled:bg-surface-elevated disabled:text-disabled disabled:shadow-none disabled:hover:bg-surface-elevated"
              >
                {playback.activeId === song.id && playback.playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button
                type="button"
                aria-label={`Stop ${song.title}`}
                disabled={playback.activeId !== song.id}
                onClick={() => playback.stopSong(song.id)}
                className="grid size-8 place-items-center rounded-full bg-surface-elevated text-ink outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-disabled disabled:hover:brightness-100"
              >
                <StopIcon />
              </button>
            </div>
            <RowMenu
              label={`${song.title} actions`}
              items={[
                { label: "Arrangement", onSelect: () => onArrange(song.id) },
                ...(rows.length > 1
                  ? [
                      { label: "Move up", disabled: index === 0, onSelect: () => place(song.id, index - 1) },
                      { label: "Move down", disabled: index === rows.length - 1, onSelect: () => place(song.id, index + 1) },
                    ]
                  : []),
                { label: "Download", disabled: true },
                { label: "Delete", onSelect: () => void history.removeSong(showId, song) },
              ]}
            />
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="relative flex h-16 w-full items-center rounded-xl bg-surface px-3 text-disabled outline-none hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <span className="w-[18px] text-left text-[15px] font-semibold">{rows.length + 1}</span>
            <span className="absolute inset-0 grid place-items-center text-[18px] font-semibold">+</span>
          </button>
        </li>
      </ul>
      {adding ? (
        <Modal title="Add song" tone="background" onClose={() => setAdding(false)}>
          <SongForm
            showId={showId}
            action={createSong.bind(null, showId)}
            onSaved={(song) => {
              setAdding(false);
              history.record({ kind: "add", showId, song });
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}

function ProgressMark({ progress }: { progress: number }) {
  const radius = 6;
  const turn = 2 * Math.PI * radius;
  const filled = Math.min(Math.max(progress, 0), 1) * turn;
  return (
    <span className="grid size-9 shrink-0 place-items-center text-primary" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} role="progressbar">
      <svg width="22" height="22" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.6" />
        <circle
          cx="8"
          cy="8"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${turn}`}
          transform="rotate(-90 8 8)"
        />
      </svg>
    </span>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="translate-x-px">
      <path fill="currentColor" d="M5.4 3.2v9.6l7-4.8-7-4.8Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M4.2 3h2.4v10H4.2zm5.2 0h2.4v10H9.4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4.2" y="4.2" width="7.6" height="7.6" rx="1.6" fill="currentColor" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
      <path fill="currentColor" d="M2 2.5h1.5V4H2V2.5Zm4.5 0H8V4H6.5V2.5ZM2 7h1.5v1.5H2V7Zm4.5 0H8v1.5H6.5V7ZM2 11.5h1.5V13H2v-1.5Zm4.5 0H8V13H6.5v-1.5Z" />
    </svg>
  );
}

function NoteMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-background text-ink">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path fill="currentColor" d="M6 3.2h1.4v6.2a2.2 2.2 0 1 1-1.4-2.05V3.2Zm6.2-.8v6.6a2.2 2.2 0 1 1-1.4-2.05V4.1L6 5.1V3.6l6.2-1.2Z" />
      </svg>
    </span>
  );
}
