"use client";

import { useState } from "react";
import { Modal } from "../components/modal";
import { RowMenu } from "../components/row-menu";
import { createSong } from "./actions";
import { useSetlistHistory } from "./history";
import { songLine } from "./format";
import { SongForm } from "./song-form";
import type { Song } from "./types";

export function SongList({
  showId,
  songs,
  onArrange,
}: {
  showId: string;
  songs: Song[];
  onArrange: (songId: string) => void;
}) {
  const history = useSetlistHistory();
  const [adding, setAdding] = useState(false);
  const slots = songs.length + 1;

  return (
    <>
      <ul className="mt-4 grid gap-2">
        {Array.from({ length: slots }, (_, index) => {
          const song = songs[index];
          const number = index + 1;
          if (!song) {
            return (
              <li key="add">
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="relative flex h-16 w-full items-center rounded-xl bg-surface px-3 text-disabled outline-none hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-primary-hover"
                >
                  <span className="w-[18px] text-left text-[15px] font-semibold">{number}</span>
                  <span className="absolute inset-0 grid place-items-center text-[18px] font-semibold">+</span>
                </button>
              </li>
            );
          }
          return (
            <li key={song.id} className="flex h-16 items-center gap-3 rounded-xl bg-surface px-3">
              <span className="w-[18px] shrink-0 text-[15px] font-semibold text-muted">{number}</span>
              <NoteMark />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold text-ink">{song.title}</span>
                <span className="mt-0.5 block truncate text-[13px] text-muted">{songLine(song)}</span>
              </span>
              <RowMenu
                label={`${song.title} actions`}
                items={[
                  { label: "Arrangement", onSelect: () => onArrange(song.id) },
                  { label: "Download", disabled: true },
                  { label: "Delete", onSelect: () => void history.removeSong(showId, song) },
                ]}
              />
            </li>
          );
        })}
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

function NoteMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-background text-ink">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path fill="currentColor" d="M6 3.2h1.4v6.2a2.2 2.2 0 1 1-1.4-2.05V3.2Zm6.2-.8v6.6a2.2 2.2 0 1 1-1.4-2.05V4.1L6 5.1V3.6l6.2-1.2Z" />
      </svg>
    </span>
  );
}
