import type { Song } from "./types";

export function songCountLabel(count: number) {
  return count === 1 ? "1 song" : `${count} songs`;
}

export function songLine(song: Pick<Song, "key" | "tempo">) {
  return `${song.key ?? "—"} · ${Math.round(song.tempo)} BPM`;
}
