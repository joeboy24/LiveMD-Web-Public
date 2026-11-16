import { storedMix } from "./mix";
import { storedStage } from "./stage";
import type { PublishedShow, PublishedSong, Song } from "./types";

export function publishableSongs(songs: Song[]): PublishedSong[] {
  return songs.map((song) => ({
    id: song.id,
    title: song.title,
    tempo: song.tempo,
    beatsPerBar: song.beatsPerBar,
    key: song.key,
    leadBeats: song.leadBeats,
    slipBars: song.slipBars,
    lyrics: song.lyrics,
    sections: song.sections.map((section) => ({
      name: section.name,
      bars: section.bars,
      sourceIndex: section.sourceIndex,
      sourceStartBar: section.sourceStartBar,
      sourceBars: section.sourceBars,
    })),
    cues: song.cues.map((cue) => ({
      bar: cue.bar,
      text: cue.text,
      place: cue.place,
      y: cue.y,
    })),
    stemKey: song.stemKey,
    guideKey: song.guideKey,
    trackKeys: [...song.trackKeys],
    mix: storedMix(song.mix),
    stage: storedStage(song.stage),
    position: song.position,
  }));
}

export function samePublication(left: PublishedSong[], right: PublishedSong[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function snapshotSongs(value: unknown): PublishedSong[] | null {
  const record = typeof value === "string" ? parseJson(value) : value;
  if (!record || typeof record !== "object" || !("songs" in record)) return null;
  const songs = (record as { songs?: unknown }).songs;
  if (!Array.isArray(songs)) return null;
  return publishableSongs(songs as Song[]);
}

export function publishedShow(
  show: { id: string; title: string; performedOn: string; publishedAt: string },
  songs: PublishedSong[],
): PublishedShow {
  return {
    id: show.id,
    title: show.title,
    performedOn: show.performedOn,
    publishedAt: show.publishedAt,
    songs,
  };
}

export type PlayerSong = {
  title: string;
  tempo: number;
  beatsPerBar: number;
  stemFile: string;
  guideFile?: string;
  trackFiles: string[];
  key?: string;
  addedOnDevice: false;
  sections: PlayerSection[];
  cues: PlayerCue[];
  leadBeats: number;
  slipBars: number;
  lyrics: string;
};

type PlayerSection = {
  name: string;
  bars: number;
  sourceIndex?: number;
  sourceStartBar?: number;
  sourceBars?: number;
};

type PlayerCue = {
  bar: number;
  text: string;
  place?: number;
  y?: number;
};

export function playerFileName(key: string | null) {
  if (!key) return null;
  const parts = key.split("/");
  if (parts.length !== 4 || parts[0] !== "shows") return null;
  const id = parts[2] ?? "";
  const name = parts[3] ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  if (!/^[A-Za-z0-9._-]{1,180}$/.test(name)) return null;
  return `${id}-${name}`;
}

export function playerSongs(songs: PublishedSong[]): PlayerSong[] {
  const records: PlayerSong[] = [];
  for (const song of songs) {
    const stemFile = playerFileName(song.stemKey);
    if (!stemFile) continue;
    const guideFile = playerFileName(song.guideKey);
    const record: PlayerSong = {
      title: song.title,
      tempo: song.tempo,
      beatsPerBar: song.beatsPerBar,
      stemFile,
      trackFiles: song.trackKeys.flatMap((key) => {
        const name = playerFileName(key);
        return name ? [name] : [];
      }),
      addedOnDevice: false,
      sections: song.sections.map(playerSection),
      cues: song.cues.map(playerCue),
      leadBeats: song.leadBeats,
      slipBars: song.slipBars,
      lyrics: song.lyrics,
    };
    if (guideFile) record.guideFile = guideFile;
    if (song.key) record.key = song.key;
    records.push(record);
  }
  return records;
}

function playerSection(section: PublishedSong["sections"][number]): PlayerSection {
  const record: PlayerSection = { name: section.name, bars: section.bars };
  if (typeof section.sourceIndex === "number") record.sourceIndex = section.sourceIndex;
  if (typeof section.sourceStartBar === "number") record.sourceStartBar = section.sourceStartBar;
  if (typeof section.sourceBars === "number") record.sourceBars = section.sourceBars;
  return record;
}

function playerCue(cue: PublishedSong["cues"][number]): PlayerCue {
  const record: PlayerCue = { bar: cue.bar, text: cue.text };
  if (typeof cue.place === "number") record.place = cue.place;
  if (typeof cue.y === "number") record.y = cue.y;
  return record;
}

export type OfflineSong = PlayerSong & {
  pitch: number;
  applyStem: boolean;
  sourceTempo: number | null;
  clickOutput: number;
  stemsOutput: number;
  guideOutput: number;
};

export type OfflineFile = {
  name: string;
  key: string;
};

export function offlinePackage(songs: PublishedSong[]): { songs: OfflineSong[]; files: OfflineFile[] } | null {
  const records: OfflineSong[] = [];
  const files: OfflineFile[] = [];
  const names = new Set<string>();
  for (const song of songs) {
    if (!song.stemKey) continue;
    const stemFile = playerFileName(song.stemKey);
    const guideFile = song.guideKey ? playerFileName(song.guideKey) : null;
    if (!stemFile || (song.guideKey && !guideFile)) return null;
    const trackFiles: string[] = [];
    for (const key of song.trackKeys) {
      const name = playerFileName(key);
      if (!name) return null;
      trackFiles.push(name);
    }
    const listed = [stemFile, ...(guideFile ? [guideFile] : []), ...trackFiles];
    if (listed.some((name) => names.has(name))) return null;
    listed.forEach((name) => names.add(name));
    const record: OfflineSong = {
      title: song.title,
      tempo: song.tempo,
      beatsPerBar: song.beatsPerBar,
      stemFile,
      trackFiles,
      addedOnDevice: false,
      sections: song.sections.map(playerSection),
      cues: song.cues.map(playerCue),
      leadBeats: song.leadBeats,
      slipBars: song.slipBars,
      lyrics: song.lyrics,
      pitch: song.stage.pitch,
      applyStem: song.stage.applyStem,
      sourceTempo: song.stage.sourceTempo,
      clickOutput: song.stage.route.click,
      stemsOutput: song.stage.route.stems,
      guideOutput: song.stage.route.guide,
    };
    if (guideFile) record.guideFile = guideFile;
    if (song.key) record.key = song.key;
    records.push(record);
    files.push({ name: `audio/${stemFile}`, key: song.stemKey });
    if (guideFile && song.guideKey) files.push({ name: `audio/${guideFile}`, key: song.guideKey });
    song.trackKeys.forEach((key, index) => {
      const name = trackFiles[index];
      if (name) files.push({ name: `audio/${name}`, key });
    });
  }
  return { songs: records, files };
}

export function downloadPublished(showId: string) {
  const link = document.createElement("a");
  link.href = `/download/${showId}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
