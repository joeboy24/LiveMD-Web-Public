import { displayKey } from "./stage";
import type { Song } from "./types";

export function songCountLabel(count: number) {
  return count === 1 ? "1 song" : `${count} songs`;
}

export function songLine(song: Pick<Song, "key" | "tempo" | "stage">) {
  return `${displayKey(song.key, song.stage.pitch)} · ${Math.round(song.tempo)} BPM`;
}
