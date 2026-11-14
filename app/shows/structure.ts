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

export function lyricBlocks(raw: string, sections: { name: string }[]) {
  const decoded = decodeSectionLyrics(raw);
  if (decoded && decoded.length > 0) {
    return sections.map((section, index) => ({
      name: section.name,
      lines: decoded[index]?.lines ?? [],
    }));
  }
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  return sections.map((section, index) => ({ name: section.name, lines: index === 0 ? lines : [] }));
}

export function encodeSectionLyrics(blocks: { name: string; lines: string[] }[]) {
  return blocks.map((block) => `\u001e${block.name}\u001f${block.lines.join("\n")}`).join("");
}

function decodeSectionLyrics(raw: string) {
  if (!raw.includes("\u001e")) return null;
  return raw.split("\u001e").filter(Boolean).map((block) => {
    const split = block.indexOf("\u001f");
    const name = split < 0 ? block : block.slice(0, split);
    const body = split < 0 ? "" : block.slice(split + 1);
    const lines = body.split("\n").map(lyricText).filter(Boolean);
    return { name, lines };
  });
}

function lyricText(line: string) {
  if (line.startsWith("\u001d")) {
    const split = line.indexOf("\u001c");
    if (split >= 0) return line.slice(split + 1).trim();
  }
  return line.trim();
}

function customSectionColor(name: string) {
  const palette = ["#D4A017", "#8E6BBF", "#7CB342", "#5C6BC0", "#C46B4A", "#3D8FD4"];
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 33 + char.charCodeAt(0)) % palette.length;
  return palette[hash];
}

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
