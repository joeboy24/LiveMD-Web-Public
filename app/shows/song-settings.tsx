"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "../components/modal";
import { canChooseDevice, chooseDevice, connectedDevice, type StageDevice } from "./outputs";
import { displayKey, pitchNote, storedTempo } from "./stage";
import type { SongRoute, SongStage } from "./types";

const sources: Array<{ id: keyof SongRoute; label: string; hint: string; color: string }> = [
  { id: "click", label: "Click", hint: "Metronome", color: "#9A9DA1" },
  { id: "stems", label: "Stems", hint: "Song audio", color: "#076FBF" },
  { id: "guide", label: "Guide", hint: "Practice track", color: "#25C290" },
];

export function SongSettings({
  songKey,
  tempo,
  stage,
  onTempo,
  onStage,
  onClose,
}: {
  songKey: string | null;
  tempo: number;
  stage: SongStage;
  onTempo: (tempo: number) => void;
  onStage: (stage: SongStage) => void;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<StageDevice | null>(null);
  const [looking, setLooking] = useState(false);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const saved = Math.max(stage.route.click, stage.route.stems, stage.route.guide) + 1;
  const choices = Math.min(32, Math.max(device?.outputs ?? 2, saved, 8));

  useEffect(() => {
    let alive = true;
    void connectedDevice().then((next) => {
      if (alive) setDevice(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function look() {
    setLooking(true);
    const next = await chooseDevice();
    if (next) setDevice(next);
    setLooking(false);
  }

  function setPitch(pitch: number) {
    const next = { ...stageRef.current, pitch };
    stageRef.current = next;
    onStage(next);
  }

  function setRoute(source: keyof SongRoute, output: number) {
    const next = { ...stageRef.current, route: { ...stageRef.current.route, [source]: output } };
    stageRef.current = next;
    onStage(next);
  }

  return (
    <Modal title="Song settings" wide onClose={onClose}>
      <p className="mt-1 text-[13px] text-muted">Key, tempo, and the output for click, stems, and guide.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Card title="Key">
          <Stepper
            minus="Lower the key"
            plus="Raise the key"
            onMinus={() => setPitch(Math.max(-12, stage.pitch - 1))}
            onPlus={() => setPitch(Math.min(12, stage.pitch + 1))}
          >
            <span className="block text-[26px] font-bold leading-none text-ink">{displayKey(songKey, stage.pitch)}</span>
            <span className="mt-1.5 block text-[12px] font-semibold text-muted">{pitchNote(songKey, stage.pitch)}</span>
          </Stepper>
        </Card>
        <Card
          title="Tempo"
          aside={
            <label className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
              Apply to stem
              <input
                type="checkbox"
                checked={stage.applyStem === true}
                onChange={(event) => onStage({ ...stage, applyStem: event.target.checked })}
                className="size-3.5 accent-primary"
              />
            </label>
          }
        >
          <TempoControl tempo={tempo} onTempo={onTempo} />
        </Card>
      </div>
      <section className="mt-3 rounded-2xl bg-background p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-muted">Routing</h3>
          <p className="text-[12px] text-muted">Saved for the iPad</p>
        </div>
        <div className="mt-3 grid gap-2">
          {sources.map((source) => (
            <div key={source.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
              <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: source.color }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-ink">{source.label}</span>
                <span className="block text-[12px] text-muted">{source.hint}</span>
              </span>
              <select
                aria-label={`${source.label} output`}
                value={stage.route[source.id]}
                onChange={(event) => setRoute(source.id, Number(event.target.value))}
                className="h-8 rounded-full bg-background px-3 text-[13px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                {Array.from({ length: choices }, (_, output) => (
                  <option key={output} value={output}>
                    Out {output + 1}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-3 rounded-2xl bg-background p-4">
        <h3 className="text-[13px] font-semibold text-muted">This computer</h3>
        <p className="mt-2 text-[16px] font-semibold text-ink">{device?.name ?? "Looking for an output…"}</p>
        {device ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: device.outputs }, (_, output) => {
              const used = sources.filter((source) => stage.route[source.id] === output);
              return (
                <span
                  key={output}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${used.length ? "bg-surface text-ink" : "text-muted"}`}
                >
                  {used.map((source) => (
                    <span key={source.id} className="size-1.5 rounded-full" style={{ backgroundColor: source.color }} />
                  ))}
                  Out {output + 1}
                </span>
              );
            })}
          </div>
        ) : null}
        {canChooseDevice() ? (
          <button
            type="button"
            onClick={() => void look()}
            disabled={looking}
            className="mt-3 h-8 rounded-full bg-surface px-3 text-[13px] font-semibold text-ink outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-primary-hover disabled:text-muted"
          >
            {looking ? "Looking…" : "Show connected outputs"}
          </button>
        ) : null}
      </section>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full bg-primary px-4 text-[14px] font-semibold text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-background px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-muted">{title}</h3>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stepper({
  minus,
  plus,
  onMinus,
  onPlus,
  children,
}: {
  minus: string;
  plus: string;
  onMinus: () => void;
  onPlus: () => void;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <Step label={minus} onClick={onMinus}>
        −
      </Step>
      <span className="min-w-0 flex-1 text-center">{children}</span>
      <Step label={plus} onClick={onPlus}>
        +
      </Step>
    </span>
  );
}

function TempoControl({ tempo, onTempo }: { tempo: number; onTempo: (tempo: number) => void }) {
  const [shown, setShown] = useState(tempo);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const live = useRef(tempo);
  const dirty = useRef(false);
  const editingRef = useRef(false);
  const cancelEdit = useRef(false);
  const onTempoRef = useRef(onTempo);
  onTempoRef.current = onTempo;
  editingRef.current = editing;

  useEffect(() => {
    if (dirty.current) return;
    live.current = tempo;
    setShown(tempo);
  }, [tempo]);

  function commit(next: number) {
    const clean = storedTempo(next);
    live.current = clean;
    dirty.current = false;
    setShown(clean);
    if (clean !== tempo) onTempoRef.current(clean);
  }

  function step(delta: number) {
    if (editingRef.current) return;
    const next = storedTempo(live.current + delta);
    live.current = next;
    dirty.current = true;
    setShown(next);
  }

  function finishEdit() {
    setEditing(false);
    if (cancelEdit.current) {
      cancelEdit.current = false;
      return;
    }
    if (text.trim() === "" || !Number.isFinite(Number(text))) return;
    commit(Number(text));
  }

  return (
    <span className="flex items-center gap-2">
      <HoldStep label="Slower" onStep={() => step(-1)} onRelease={() => commit(live.current)}>
        −
      </HoldStep>
      <span className="min-w-0 flex-1 text-center">
        {editing ? (
          <input
            autoFocus
            inputMode="numeric"
            aria-label="Tempo"
            value={text}
            onFocus={(event) => event.target.select()}
            onChange={(event) => setText(event.target.value.replace(/\D/g, "").slice(0, 3))}
            onBlur={finishEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                cancelEdit.current = true;
                event.currentTarget.blur();
              }
            }}
            className="w-full bg-transparent text-center text-[26px] font-bold leading-none text-ink tabular-nums outline-none"
          />
        ) : (
          <button
            type="button"
            aria-label="Edit tempo"
            onClick={() => {
              setText(String(shown));
              setEditing(true);
            }}
            className="w-full cursor-pointer text-[26px] font-bold leading-none text-ink tabular-nums outline-none"
          >
            {shown}
          </button>
        )}
        <span className="mt-1.5 block text-[12px] font-semibold text-muted">BPM</span>
      </span>
      <HoldStep label="Faster" onStep={() => step(1)} onRelease={() => commit(live.current)}>
        +
      </HoldStep>
    </span>
  );
}

function HoldStep({
  label,
  onStep,
  onRelease,
  children,
}: {
  label: string;
  onStep: () => void;
  onRelease: () => void;
  children: string;
}) {
  const stepRef = useRef(onStep);
  const releaseRef = useRef(onRelease);
  stepRef.current = onStep;
  releaseRef.current = onRelease;
  const timers = useRef<number[]>([]);
  const handled = useRef(false);
  const started = useRef(0);

  function clearTimers() {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }

  function tick() {
    stepRef.current();
    const delay = performance.now() - started.current > 800 ? 36 : 80;
    timers.current.push(window.setTimeout(tick, delay));
  }

  function finish() {
    clearTimers();
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    releaseRef.current();
    window.setTimeout(() => {
      handled.current = false;
    }, 0);
  }

  useEffect(() => clearTimers, []);

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        handled.current = true;
        clearTimers();
        started.current = performance.now();
        stepRef.current();
        timers.current.push(window.setTimeout(tick, 300));
        window.addEventListener("pointerup", finish);
        window.addEventListener("pointercancel", finish);
      }}
      onClick={() => {
        if (handled.current) return;
        stepRef.current();
        releaseRef.current();
      }}
      className="grid size-9 shrink-0 touch-none place-items-center rounded-full bg-surface text-[18px] font-semibold text-ink outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-primary-hover"
    >
      {children}
    </button>
  );
}

function Step({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-[18px] font-semibold text-ink outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-primary-hover"
    >
      {children}
    </button>
  );
}
