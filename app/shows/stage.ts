import type { SongStage } from "./types";

const sharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const flat = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const index = new Map<string, number>();
sharp.forEach((name, place) => index.set(name, place));
flat.forEach((name, place) => index.set(name, place));

export function defaultStage(): SongStage {
  return { pitch: 0, route: { click: 0, stems: 1, guide: 0 }, applyStem: false, sourceTempo: null };
}

export function storedStage(value: unknown): SongStage {
  const record = typeof value === "string" ? parseJson(value) : value;
  if (!record || typeof record !== "object") return defaultStage();
  const stage = record as Partial<SongStage>;
  const route = stage.route;
  return {
    pitch: semitones(stage.pitch),
    route: {
      click: output(route?.click, 0),
      stems: output(route?.stems, 1),
      guide: output(route?.guide, 0),
    },
    applyStem: stage.applyStem === true,
    sourceTempo: fileTempo(stage.sourceTempo),
  };
}

export function stemRate(tempo: number, stage: SongStage) {
  if (!stage.applyStem) return 1;
  const source = stage.sourceTempo ?? tempo;
  if (!(source > 0) || !(tempo > 0)) return 1;
  return Math.min(4, Math.max(0.25, tempo / source));
}

export function withSourceTempo(previousTempo: number, nextTempo: number, stage: SongStage) {
  if (stage.sourceTempo != null || nextTempo === previousTempo) return stage;
  return { ...stage, sourceTempo: storedTempo(previousTempo) };
}

export function storedTempo(value: number) {
  if (!Number.isFinite(value)) return 120;
  return Math.min(240, Math.max(40, Math.round(value)));
}

export function displayKey(key: string | null, pitch: number) {
  if (pitch === 0) return key ?? "—";
  const shifted = shiftKey(key, pitch);
  if (shifted) return shifted;
  return pitch > 0 ? `Key +${pitch}` : `Key ${pitch}`;
}

export function pitchNote(key: string | null, pitch: number) {
  if (pitch === 0) return key ? `Written in ${key}` : "Written key";
  const steps = Math.abs(pitch) === 1 ? "1 semitone" : `${Math.abs(pitch)} semitones`;
  const direction = pitch > 0 ? "higher" : "lower";
  return key ? `${steps} ${direction} than ${key}` : `${steps} ${direction}`;
}

export function shiftKey(key: string | null, pitch: number) {
  if (!key) return null;
  const match = key.trim().match(/^([A-Ga-g])([#b♯♭]?)/);
  if (!match) return null;
  const accidental = match[2] === "♯" ? "#" : match[2] === "♭" ? "b" : match[2];
  const place = index.get(match[1].toUpperCase() + accidental);
  if (place == null) return null;
  const names = accidental === "b" ? flat : sharp;
  return names[(place + pitch + 120) % 12] + key.trim().slice(match[0].length);
}

function fileTempo(value: unknown) {
  if (value == null || value === "") return null;
  const tempo = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(tempo)) return null;
  return storedTempo(tempo);
}

function semitones(value: unknown) {
  const pitch = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(pitch)) return 0;
  return Math.min(12, Math.max(-12, pitch));
}

function output(value: unknown, fallback: number) {
  const output = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(output)) return fallback;
  return Math.min(31, Math.max(0, output));
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
