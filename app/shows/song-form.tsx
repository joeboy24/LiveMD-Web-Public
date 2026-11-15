"use client";

import { useActionState, useRef, useState } from "react";
import { Field, TextArea } from "../components/field";
import { ImportRow } from "../components/import-row";
import { signUpload } from "./actions";
import { storedTempo } from "./stage";
import { suggestTempo } from "./tempo";
import type { FormState, Song } from "./types";

const keys = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const initialState: FormState = { error: null };

export function SongForm({
  showId,
  action,
  onSaved,
  song,
}: {
  showId: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  onSaved?: (song: Song) => void;
  song?: Song;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const plainLyrics = readableLyrics(song?.lyrics ?? "");
  const [title, setTitle] = useState(song?.title ?? "");
  const [tempo, setTempo] = useState(song ? storedTempo(song.tempo) : 120);
  const [key, setKey] = useState(song?.key ?? "");
  const [lyrics, setLyrics] = useState(plainLyrics);
  const [trackOne, setTrackOne] = useState<File | null>(null);
  const [trackTwo, setTrackTwo] = useState<File | null>(null);
  const [guide, setGuide] = useState<File | null>(null);
  const [suggested, setSuggested] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const tempoOverride = useRef<number | null>(null);
  const ignored = useRef<{ fileKey: string; tempo: number } | null>(null);
  const ready = title.trim().length > 0;
  const uploading = Boolean(trackOne || trackTwo || guide);
  const [state, formAction, pending] = useActionState(async (previous: FormState, formData: FormData) => {
    if (tempoOverride.current !== null) {
      formData.set("tempo", String(tempoOverride.current));
      tempoOverride.current = null;
    } else if (trackOne) {
      const key = fileKey(trackOne);
      const entered = Number(formData.get("tempo"));
      const skipped = ignored.current?.fileKey === key && ignored.current.tempo === entered;
      if (!skipped) {
        setChecking(true);
        const offer = await suggestTempo(trackOne, entered);
        setChecking(false);
        if (offer !== null) {
          setSuggested(offer);
          return { error: null };
        }
      }
    }
    if (song && lyrics === plainLyrics) formData.set("lyrics", song.lyrics);
    try {
      if (trackOne) formData.set("stemKey", await uploadAudio(showId, trackOne));
      if (trackTwo) formData.set("trackKey", await uploadAudio(showId, trackTwo));
      if (guide) formData.set("guideKey", await uploadAudio(showId, guide));
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The audio didn't upload." };
    }
    const result = await action(previous, formData);
    if (result.saved) {
      formRef.current?.reset();
      setTitle("");
      setTempo(120);
      setKey("");
      setLyrics("");
      setTrackOne(null);
      setTrackTwo(null);
      setGuide(null);
      setSuggested(null);
      ignored.current = null;
      if (result.song) onSaved?.(result.song);
    }
    return result;
  }, initialState);

  function changeTempo(next: number) {
    setTempo(next);
    setSuggested(null);
    ignored.current = null;
  }

  return (
    <form ref={formRef} action={formAction}>
      {song ? <input type="hidden" name="songId" value={song.id} /> : null}
      <Field
        className="mt-4"
        label="Title"
        name="title"
        hideLabel
        tone="surface"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
        required
      />
      <div className="mt-3 grid gap-3">
        <ImportRow
          label="Track 1"
          empty="Choose track"
          fileName={trackOne?.name || fileLabel(song?.stemKey)}
          onFile={(file) => {
            setTrackOne(file);
            setSuggested(null);
            ignored.current = null;
          }}
        />
        <ImportRow label="Track 2" empty="Choose track" fileName={trackTwo?.name || fileLabel(song?.trackKeys[0])} onFile={setTrackTwo} />
        <ImportRow label="Guide/Cues" empty="Add a guide" fileName={guide?.name || fileLabel(song?.guideKey)} onFile={setGuide} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-[16px] font-semibold text-ink">Tempo</span>
        <span className="ml-auto flex items-center gap-2">
          <StepButton label="Slower" onClick={() => changeTempo(Math.max(40, tempo - 1))}>
            −
          </StepButton>
          <span className="w-[88px] text-center text-[16px] font-semibold text-ink">{tempo} BPM</span>
          <StepButton label="Faster" onClick={() => changeTempo(Math.min(240, tempo + 1))}>
            +
          </StepButton>
        </span>
        <label className="sr-only" htmlFor="song-key">
          Key
        </label>
        <select
          id="song-key"
          name="key"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          className="h-9 w-14 appearance-none rounded-[10px] bg-surface text-center text-[15px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          <option value="">Key</option>
          {key && !keys.includes(key) ? <option value={key}>{key}</option> : null}
          {keys.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name="tempo" value={tempo} />
      {suggested !== null ? (
        <div className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-surface px-3">
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">Tempo {suggested}</span>
          <button
            type="button"
            onClick={() => {
              tempoOverride.current = suggested;
              setTempo(suggested);
              setSuggested(null);
              if (formRef.current) formAction(new FormData(formRef.current));
            }}
            className="h-8 rounded-full bg-primary px-3 text-[14px] font-semibold text-white"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => {
              if (trackOne) ignored.current = { fileKey: fileKey(trackOne), tempo };
              setSuggested(null);
              if (formRef.current) formAction(new FormData(formRef.current));
            }}
            className="h-8 rounded-full bg-surface-elevated px-3 text-[14px] font-semibold text-ink"
          >
            Ignore
          </button>
        </div>
      ) : null}
      <TextArea
        className="mt-4"
        label="Lyrics"
        name="lyrics"
        tone="surface"
        rows={4}
        placeholder="Paste lyrics here"
        value={lyrics}
        onChange={(event) => setLyrics(event.target.value)}
      />
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending || !ready || suggested !== null}
        className={
          ready && suggested === null
            ? "mt-4 h-[52px] w-full rounded-xl bg-primary text-[17px] font-semibold text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover"
            : "mt-4 h-[52px] w-full rounded-xl bg-surface text-[17px] font-semibold text-disabled outline-none"
        }
      >
        {pending ? (checking ? "Checking tempo…" : uploading ? "Uploading…" : "Saving…") : song ? "Save" : "Add to setlist"}
      </button>
    </form>
  );
}

async function uploadAudio(showId: string, file: File) {
  const signed = await signUpload({
    showId,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });
  if ("error" in signed) throw new Error(signed.error);
  const response = await fetch(signed.url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": signed.contentType },
  });
  if (!response.ok) throw new Error("The audio didn't upload.");
  return signed.key;
}

function fileLabel(key: string | null | undefined) {
  if (!key) return "";
  const name = key.split("/").pop() ?? "";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function readableLyrics(raw: string) {
  if (!raw.includes("\u001e")) return raw;
  return raw
    .split("\u001e")
    .slice(1)
    .map((block) => {
      const body = block.split("\u001f")[1] ?? "";
      return body
        .split("\n")
        .map((line) => {
          const cut = line.indexOf("\u001c");
          return (cut >= 0 ? line.slice(cut + 1) : line).trim();
        })
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-[18px] font-semibold text-ink outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary-hover"
    >
      {children}
    </button>
  );
}
