import type { SongCue, SongSection } from "./types";

export const sectionNames = ["Intro", "Verse", "Chorus", "Bridge", "Outro"];
export const moreSectionNames = [
  "Pre-Chorus",
  "Hook",
  "Vamp",
  "Channel",
  "Breakdown",
  "Instrumental",
  "Solo",
  "Tag",
  "Turnaround",
  "Reprise",
];

export function sectionColor(name: string) {
  switch (name.trim().toLowerCase()) {
    case "intro":
      return "#25C290";
    case "verse":
      return "#1D8DE4";
    case "chorus":
      return "#FA8E23";
    case "bridge":
      return "#665A9C";
    case "end":
    case "outro":
      return "#E4372D";
    case "vamp":
      return "#D4537E";
    case "turnaround":
      return "#2BB8C7";
    case "song":
      return "var(--surface-elevated)";
    default:
      return customSectionColor(name);
  }
}

export function parseSections(value: unknown): SongSection[] {
  return asArray(value).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim().slice(0, 40);
    const bars = Number(row.bars);
    if (!name || !Number.isInteger(bars) || bars < 1 || bars > 2000) return [];
    return [
      {
        name,
        bars,
        sourceIndex: wholeNumber(row.sourceIndex),
        sourceStartBar: wholeNumber(row.sourceStartBar),
        sourceBars: wholeNumber(row.sourceBars),
      },
    ];
  });
}

export function parseCues(value: unknown): SongCue[] {
  return asArray(value).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const text = String(row.text ?? "").trim().slice(0, 80);
    const bar = Number(row.bar);
    if (!text || !Number.isInteger(bar) || bar < 1 || bar > 2000) return [];
    return [{ bar, text, place: finiteNumber(row.place), y: finiteNumber(row.y) }];
  });
}

export function sectionAtBar(sections: SongSection[], bar: number) {
  let start = 1;
  for (const section of sections) {
    if (bar < start + section.bars) return section.name;
    start += section.bars;
  }
  return sections.at(-1)?.name ?? "Song";
}

export function barLabel(bars: number) {
  return bars === 1 ? "1 bar" : `${bars} bars`;
}

export function cueColor(name: string) {
  const palette = ["#F6D7A8", "#F7C2D4", "#C9E4F8", "#D7F0C4", "#E4D4F7", "#F8E29A", "#F6CBB4", "#CDEBE4", "#F8D0C8", "#D5E2FF"];
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return "#E7EDF2";
  let hash = 0;
  for (const char of trimmed) hash = (hash * 33 + char.charCodeAt(0)) % palette.length;
  return palette[hash];
}

export type LyricLine = { text: string; place: number | null };

export function lyricBlocks(raw: string, sections: { name: string }[]) {
  const decoded = decodeSectionLyrics(raw);
  if (decoded && decoded.length > 0) {
    return sections.map((section, index) => ({
      name: section.name,
      lines: decoded[index]?.lines ?? [],
    }));
  }
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ text, place: null }));
  return sections.map((section, index) => ({ name: section.name, lines: index === 0 ? lines : [] }));
}

export function encodeSectionLyrics(blocks: { name: string; lines: LyricLine[] }[]) {
  return blocks
    .map((block) => {
      const body = block.lines.map((line) => (line.place == null ? line.text : `\u001d${line.place.toFixed(4)}\u001c${line.text}`)).join("\n");
      return `\u001e${block.name}\u001f${body}`;
    })
    .join("");
}

export function lyricSectionGroups(blocks: { lines: LyricLine[] }[], sections: { name: string; bars: number }[]) {
  const spans: { name: string; start: number; end: number }[] = [];
  let cursor = 0;
  sections.forEach((section) => {
    const bars = Math.max(section.bars, 1);
    spans.push({ name: section.name, start: cursor, end: cursor + bars });
    cursor += bars;
  });
  const flat: { section: number; line: number; text: string; place: number | null }[] = [];
  blocks.forEach((block, sectionIndex) => {
    block.lines.forEach((line, lineIndex) => {
      flat.push({ section: sectionIndex, line: lineIndex, text: line.text, place: line.place });
    });
  });
  const places = resolvedPlaces(
    flat.map((line) => ({ text: line.text, place: line.place })),
    0,
    Math.max(cursor, 1),
  );
  const groups = spans.map((span, index) => ({ name: span.name, index, lines: [] as { section: number; line: number; text: string }[] }));
  flat.forEach((line, index) => {
    const place = places[index] ?? 0;
    let spanIndex = spans.findIndex((span) => place >= span.start && place < span.end);
    if (spanIndex < 0) spanIndex = Math.max(spans.length - 1, 0);
    groups[spanIndex]?.lines.push({ section: line.section, line: line.line, text: line.text });
  });
  return groups.filter((group) => group.lines.length > 0);
}

export function placedLyrics(blocks: { lines: LyricLine[] }[], sections: { bars: number }[]) {
  let start = 0;
  const placed: { section: number; line: number; text: string; place: number; taught: boolean }[] = [];
  blocks.forEach((block, sectionIndex) => {
    const bars = Math.max(sections[sectionIndex]?.bars ?? 1, 1);
    const end = start + bars;
    const places = resolvedPlaces(block.lines, start, end);
    block.lines.forEach((line, lineIndex) => {
      const place = line.place != null ? line.place : places[lineIndex];
      if (place == null) return;
      placed.push({ section: sectionIndex, line: lineIndex, text: line.text, place, taught: line.place != null });
    });
    start = end;
  });
  return placed;
}

export function activeLyricIndex(placed: { place: number; taught?: boolean }[], playhead: number) {
  let best = -1;
  let bestPlace = -Infinity;
  placed.forEach((line, index) => {
    if (line.taught === false) return;
    if (line.place <= playhead + 0.02 && line.place >= bestPlace) {
      best = index;
      bestPlace = line.place;
    }
  });
  return best;
}

function resolvedPlaces(lines: LyricLine[], start: number, end: number) {
  const count = lines.length;
  if (count === 0) return [];
  const span = Math.max(end - start, 0.001);
  const places = lines.map((_, index) => start + (index / count) * span);
  const known: { index: number; place: number }[] = [{ index: -1, place: start }];
  let last = start;
  lines.forEach((line, index) => {
    if (line.place == null) return;
    const clamped = Math.min(Math.max(line.place, last), end);
    known.push({ index, place: clamped });
    last = clamped;
  });
  known.push({ index: count, place: Math.max(end, last) });
  for (let pair = 0; pair < known.length - 1; pair += 1) {
    const left = known[pair];
    const right = known[pair + 1];
    const gap = right.index - left.index;
    if (gap <= 1) continue;
    for (let step = 1; step < gap; step += 1) {
      const index = left.index + step;
      if (!lines[index] || lines[index].place != null) continue;
      places[index] = left.place + ((right.place - left.place) * step) / gap;
    }
  }
  lines.forEach((line, index) => {
    if (line.place != null) places[index] = Math.min(Math.max(line.place, start), end);
  });
  for (let index = 1; index < count; index += 1) {
    if (places[index] < places[index - 1]) places[index] = places[index - 1];
  }
  return places;
}

function decodeSectionLyrics(raw: string) {
  if (!raw.includes("\u001e")) return null;
  return raw
    .split("\u001e")
    .filter(Boolean)
    .map((block) => {
      const split = block.indexOf("\u001f");
      const name = split < 0 ? block : block.slice(0, split);
      const body = split < 0 ? "" : block.slice(split + 1);
      const lines = body
        .split("\n")
        .map(parseLyricLine)
        .filter((line) => line.text);
      return { name, lines };
    });
}

function parseLyricLine(line: string): LyricLine {
  if (line.startsWith("\u001d")) {
    const split = line.indexOf("\u001c");
    if (split >= 0) {
      const place = Number(line.slice(1, split));
      return { text: line.slice(split + 1).trim(), place: Number.isFinite(place) ? place : null };
    }
  }
  return { text: line.trim(), place: null };
}

function customSectionColor(name: string) {
  const palette = ["#D4A017", "#8E6BBF", "#7CB342", "#5C6BC0", "#C46B4A", "#3D8FD4"];
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 33 + char.charCodeAt(0)) % palette.length;
  return palette[hash];
}

export function cueSpeechPlace(text: string, anchor: number, barSize: number) {
  const sample = text.trim() || "Cue";
  const textWidth = measureCueText(sample);
  const shown = barSize >= 88 || textWidth + 20 <= barSize * 1.2;
  if (!shown) return anchor;
  const halfBars = (textWidth + 20) / (2 * Math.max(barSize, 1));
  return Math.max(anchor - halfBars, 0);
}

function measureCueText(text: string) {
  if (typeof document === "undefined") return text.length * 7;
  cueMeasure ??= document.createElement("canvas");
  const context = cueMeasure.getContext("2d");
  if (!context) return text.length * 7;
  context.font = "600 13px system-ui, sans-serif";
  return Math.ceil(context.measureText(text).width);
}

let cueMeasure: HTMLCanvasElement | null = null;

function asArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function wholeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
