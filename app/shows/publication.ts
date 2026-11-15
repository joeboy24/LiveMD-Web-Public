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
