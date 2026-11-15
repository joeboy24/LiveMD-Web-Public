"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { deleteShow, deleteSong, orderSongs, restoreShow, restoreSong } from "./actions";
import type { ShowSnapshot, Song } from "./types";

type Change =
  | { kind: "add" | "remove"; showId: string; song: Song }
  | { kind: "order"; showId: string; before: string[]; after: string[] }
  | { kind: "add-show" | "delete-show"; show: ShowSnapshot; reopen: boolean };

type HistoryApi = {
  canUndo: boolean;
  canRedo: boolean;
  record: (change: Change) => void;
  removeShow: (showId: string, reopen: boolean) => Promise<void>;
  removeSong: (showId: string, song: Song) => Promise<void>;
  moveSongs: (showId: string, before: string[], after: string[]) => Promise<string | null>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

const HistoryContext = createContext<HistoryApi | null>(null);

export function SetlistHistory({ children }: { children: ReactNode }) {
  const router = useRouter();
  const undoRef = useRef<Change[]>([]);
  const redoRef = useRef<Change[]>([]);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  function bump() {
    setTick((value) => value + 1);
  }

  function record(change: Change) {
    undoRef.current.push(change);
    redoRef.current = [];
    bump();
  }

  function viewing(showId: string) {
    return new URLSearchParams(window.location.search).get("show") === showId;
  }

  async function dropShow(change: { show: ShowSnapshot }, leave: boolean) {
    const latest = await deleteShow(change.show.id);
    if (latest) change.show = latest;
    if (leave && viewing(change.show.id)) router.push("/");
  }

  async function openShow(change: { show: ShowSnapshot }, enter: boolean) {
    await restoreShow(change.show);
    if (enter) router.push(`/?show=${change.show.id}`);
  }

  async function apply(change: Change, direction: "undo" | "redo") {
    const reverse = direction === "undo";
    if (change.kind === "remove" || change.kind === "add") {
      const removing = change.kind === "remove" ? !reverse : reverse;
      if (removing) await deleteSong(change.song.id);
      else await restoreSong(change.showId, change.song);
      return;
    }
    if (change.kind === "order") {
      await orderSongs(change.showId, reverse ? change.before : change.after);
      return;
    }
    if (change.kind === "delete-show" || change.kind === "add-show") {
      const removing = change.kind === "delete-show" ? !reverse : reverse;
      const enter = change.reopen || change.kind === "add-show";
      if (removing) await dropShow(change, enter);
      else await openShow(change, enter);
    }
  }

  async function undo() {
    const change = undoRef.current.pop();
    if (!change || busy) return;
    setBusy(true);
    try {
      await apply(change, "undo");
      redoRef.current.push(change);
    } catch {
      undoRef.current.push(change);
    } finally {
      setBusy(false);
      bump();
    }
  }

  async function redo() {
    const change = redoRef.current.pop();
    if (!change || busy) return;
    setBusy(true);
    try {
      await apply(change, "redo");
      undoRef.current.push(change);
    } catch {
      redoRef.current.push(change);
    } finally {
      setBusy(false);
      bump();
    }
  }

  async function removeShow(showId: string, reopen: boolean) {
    const show = await deleteShow(showId);
    if (!show) return;
    record({ kind: "delete-show", show, reopen });
    if (reopen && viewing(showId)) router.push("/");
  }

  async function removeSong(showId: string, song: Song) {
    await deleteSong(song.id);
    record({ kind: "remove", showId, song });
  }

  async function moveSongs(showId: string, before: string[], after: string[]) {
    if (before.join() === after.join()) return null;
    const result = await orderSongs(showId, after);
    if (result.error) return result.error;
    record({ kind: "order", showId, before, after });
    return null;
  }

  const api: HistoryApi = {
    canUndo: tick >= 0 && undoRef.current.length > 0 && !busy,
    canRedo: tick >= 0 && redoRef.current.length > 0 && !busy,
    record,
    removeShow,
    removeSong,
    moveSongs,
    undo,
    redo,
  };

  return <HistoryContext.Provider value={api}>{children}</HistoryContext.Provider>;
}

export function useSetlistHistory() {
  const history = useContext(HistoryContext);
  if (!history) throw new Error("Setlist history is missing.");
  return history;
}

export function HistoryButtons({ className = "" }: { className?: string }) {
  const history = useSetlistHistory();
  if (!history.canUndo && !history.canRedo) return null;
  return (
    <div className={`flex items-center justify-end ${className}`}>
      <button
        type="button"
        aria-label="Undo"
        disabled={!history.canUndo}
        onClick={() => void history.undo()}
        className="grid size-8 place-items-center rounded-lg text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-disabled"
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        aria-label="Redo"
        disabled={!history.canRedo}
        onClick={() => void history.redo()}
        className="grid size-8 place-items-center rounded-lg text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-disabled"
      >
        <RedoIcon />
      </button>
    </div>
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
