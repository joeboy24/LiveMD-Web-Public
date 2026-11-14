"use client";

import { useActionState, useRef, useState } from "react";
import { Field, TextArea } from "../components/field";
import { ImportRow } from "../components/import-row";
import { signUpload } from "./actions";
import type { FormState, Song } from "./types";

const keys = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const initialState: FormState = { error: null };

export function SongForm({
  showId,
  action,
  onSaved,
}: {
  showId: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  onSaved?: (song: Song) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [tempo, setTempo] = useState(120);
  const [key, setKey] = useState("");
  const [trackOne, setTrackOne] = useState<File | null>(null);
  const [trackTwo, setTrackTwo] = useState<File | null>(null);
  const [guide, setGuide] = useState<File | null>(null);
  const ready = title.trim().length > 0;
  const uploading = Boolean(trackOne || trackTwo || guide);
  const [state, formAction, pending] = useActionState(async (previous: FormState, formData: FormData) => {
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
      setTrackOne(null);
      setTrackTwo(null);
      setGuide(null);
      if (result.song) onSaved?.(result.song);
    }
    return result;
  }, initialState);

  return (
    <form ref={formRef} action={formAction}>
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
        <ImportRow label="Track 1" empty="Choose track" fileName={trackOne?.name ?? ""} onFile={setTrackOne} />
        <ImportRow label="Track 2" empty="Choose track" fileName={trackTwo?.name ?? ""} onFile={setTrackTwo} />
        <ImportRow label="Guide/Cues" empty="Add a guide" fileName={guide?.name ?? ""} onFile={setGuide} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-[16px] font-semibold text-ink">Tempo</span>
        <span className="ml-auto flex items-center gap-2">
          <StepButton label="Slower" onClick={() => setTempo((value) => Math.max(40, value - 1))}>
            −
          </StepButton>
          <span className="w-[88px] text-center text-[16px] font-semibold text-ink">{tempo} BPM</span>
          <StepButton label="Faster" onClick={() => setTempo((value) => Math.min(240, value + 1))}>
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
          {keys.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name="tempo" value={tempo} />
      <TextArea className="mt-4" label="Lyrics" name="lyrics" tone="surface" rows={4} placeholder="Paste lyrics here" />
      {state.error ? <p className="mt-3 text-sm text-[#e4372d]">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending || !ready}
        className={
          ready
            ? "mt-4 h-[52px] w-full rounded-xl bg-primary text-[17px] font-semibold text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover"
            : "mt-4 h-[52px] w-full rounded-xl bg-surface text-[17px] font-semibold text-disabled outline-none"
        }
      >
        {pending ? (uploading ? "Uploading…" : "Saving…") : "Add to setlist"}
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
