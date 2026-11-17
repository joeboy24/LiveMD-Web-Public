"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RowMenu } from "../components/row-menu";
import { publishShow } from "./actions";
import { Arrangement } from "./arrangement";
import { useSetlistHistory } from "./history";
import { PERFORMANCE_MODE_EVENT, readPerformanceMode, writePerformanceMode } from "./performance-mode";
import { downloadPublished, publishableSongs, samePublication } from "./publication";
import { flushSaves } from "./save-queue";
import { SongList } from "./song-list";
import { useSetlistPlayback } from "./setlist-playback";
import type { PublishedShow, Song } from "./types";

export function SongPanel({
  showId,
  title,
  dateLabel,
  songs,
  publication,
  rehearsal: initialRehearsal,
  canEdit = true,
  canPlay = true,
  canOpen = true,
  canStage = true,
  canPublish = true,
}: {
  showId: string;
  title: string;
  dateLabel: string;
  songs: Song[];
  publication: PublishedShow | null;
  rehearsal: boolean;
  canEdit?: boolean;
  canPlay?: boolean;
  canOpen?: boolean;
  canStage?: boolean;
  canPublish?: boolean;
}) {
  const history = useSetlistHistory();
  const router = useRouter();
  const params = useSearchParams();
  const edits = useRef(new Map<string, Song>());
  const [library, setLibrary] = useState(songs);
  const [activeShow, setActiveShow] = useState(showId);
  const [published, setPublished] = useState(publication);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [rehearsal, setRehearsal] = useState(initialRehearsal);
  if (activeShow !== showId) {
    setActiveShow(showId);
    edits.current = new Map();
    setLibrary(songs);
    setPublished(publication);
  }
  const arranging = library.find((song) => song.id === params.get("song")) ?? null;
  const playback = useSetlistPlayback(showId, library);
  const inSync = published !== null && samePublication(publishableSongs(library), published.songs);
  const release = publishError ?? (published === null ? "Not published" : inSync ? "Published" : "Unpublished changes");

  useEffect(() => {
    setLibrary(songs.map((song) => edits.current.get(song.id) ?? song));
  }, [songs]);

  useEffect(() => {
    setPublished((current) => {
      if (!publication) return current && current.id === showId ? current : null;
      if (current && current.id === showId && current.publishedAt > publication.publishedAt) return current;
      return publication;
    });
  }, [publication, showId]);

  function keepSong(next: Song) {
    edits.current.set(next.id, next);
    setLibrary((current) => current.map((song) => (song.id === next.id ? next : song)));
  }

  async function publish() {
    if (!canPublish) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await flushSaves();
      const result = await publishShow(showId);
      if (result.publication) setPublished(result.publication);
      setPublishError(result.error);
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  function showSong(songId: string | null) {
    const next = new URLSearchParams(params.toString());
    next.set("show", showId);
    if (songId) next.set("song", songId);
    else next.delete("song");
    router.replace(`/?${next.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (arranging) playback.stop();
  }, [arranging, playback.stop]);

  useEffect(() => history.subscribe(keepSong), [history, keepSong]);

  useEffect(() => {
    function syncMode() {
      setRehearsal(readPerformanceMode());
    }
    window.addEventListener(PERFORMANCE_MODE_EVENT, syncMode);
    return () => window.removeEventListener(PERFORMANCE_MODE_EVENT, syncMode);
  }, []);

  function chooseMode(next: boolean) {
    setRehearsal(next);
    writePerformanceMode(next);
  }

  if (arranging) {
    return (
      <section className="flex min-h-0 flex-1 flex-col">
        <Arrangement
          key={arranging.id}
          showId={showId}
          song={arranging}
          songs={library}
          onClose={() => showSong(null)}
          onOpen={showSong}
          onDraft={keepSong}
          mode={rehearsal}
          onMode={chooseMode}
          canEdit={canEdit}
          canStage={canStage}
        />
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-[22px] font-bold text-ink">{title}</h2>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {dateLabel} · {library.length} {library.length === 1 ? "Song" : "Songs"} · {release}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            disabled={publishing || inSync}
            onClick={() => void publish()}
            className={`mr-3 h-8 rounded-full bg-primary px-3 text-[13px] font-semibold text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover disabled:bg-surface-elevated disabled:text-muted disabled:hover:bg-surface-elevated ${canPublish ? "" : "hidden"}`}
          >
            {publishing ? "Publishing" : inSync ? "Published" : "Publish"}
          </button>
          <div className={`mr-2 flex items-center gap-1 ${canPlay ? "" : "hidden"}`}>
            <button
              type="button"
              aria-label={playback.setPlaying ? "Pause" : "Play"}
              disabled={!playback.canPlay}
              onClick={playback.toggleSet}
              className="grid size-8 place-items-center rounded-full bg-primary text-white shadow-[0_4px_12px_rgb(7_111_191/0.4)] outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover disabled:bg-surface-elevated disabled:text-disabled disabled:shadow-none disabled:hover:bg-surface-elevated"
            >
              {playback.setPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              aria-label="Stop"
              disabled={!playback.activeId}
              onClick={playback.stop}
              className="grid size-8 place-items-center rounded-full bg-surface-elevated text-ink outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-disabled disabled:hover:brightness-100"
            >
              <StopIcon />
            </button>
          </div>
          {canEdit ? (
            <>
              <HeaderButton label="Undo" disabled={!history.canUndo} onClick={() => void history.undo()}>
                <UndoIcon />
              </HeaderButton>
              <HeaderButton label="Redo" disabled={!history.canRedo} onClick={() => void history.redo()}>
                <RedoIcon />
              </HeaderButton>
              <RowMenu
                label={`${title} actions`}
                items={[
                  { label: "Download", disabled: published === null, onSelect: () => downloadPublished(showId) },
                  { label: "Delete", onSelect: () => void history.removeShow(showId, true) },
                ]}
              />
            </>
          ) : null}
        </div>
      </div>
      <SongList showId={showId} songs={library} onArrange={showSong} onEdited={keepSong} playback={playback} canEdit={canEdit} canPlay={canPlay} canOpen={canOpen} />
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
  const color = disabled ? "text-disabled" : tone === "primary" ? "text-primary" : "text-ink";
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
