"use client";

import { useActionState, useRef, useState } from "react";
import { Field, TextArea } from "../components/field";
import { ImportRow } from "../components/import-row";
import type { FormState, Song } from "./types";

const keys = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const initialState: FormState = { error: null };

export function SongForm({
  action,
  onSaved,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  onSaved?: (song: Song) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [tempo, setTempo] = useState(120);
  const [key, setKey] = useState("");
  const [trackOne, setTrackOne] = useState("");
  const [trackTwo, setTrackTwo] = useState("");
  const [guide, setGuide] = useState("");
  const ready = title.trim().length > 0;
  const [state, formAction, pending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.saved) {
      formRef.current?.reset();
      setTitle("");
      setTempo(120);
      setKey("");
      setTrackOne("");
      setTrackTwo("");
      setGuide("");
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
        <ImportRow label="Track 1" empty="Choose track" fileName={trackOne} onFile={(file) => setTrackOne(file?.name ?? "")} />
        <ImportRow label="Track 2" empty="Choose track" fileName={trackTwo} onFile={(file) => setTrackTwo(file?.name ?? "")} />
        <ImportRow label="Guide/Cues" empty="Add a guide" fileName={guide} onFile={(file) => setGuide(file?.name ?? "")} />
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
        {pending ? "Saving…" : "Add to setlist"}
      </button>
    </form>
  );
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
