import { getSql } from "../db";
import type { Show, Song } from "./types";

export async function listShows(): Promise<Show[]> {
  const sql = getSql();
  const rows = await sql`
    select shows.id, shows.title, shows.performed_on as "performedOn", count(songs.id)::int as "songCount"
    from shows
    left join songs on songs.show_id = shows.id
    group by shows.id
    order by shows.performed_on desc, shows.created_at desc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    songCount: Number(row.songCount),
    ipadUpdate: false,
    ...showDate(row.performedOn),
  }));
}

export async function listSongs(showId: string): Promise<Song[]> {
  const sql = getSql();
  const rows = await sql`
    select
      id,
      title,
      tempo,
      beats_per_bar as "beatsPerBar",
      key,
      lead_beats as "leadBeats",
      slip_bars as "slipBars",
      lyrics
    from songs
    where show_id = ${showId}
    order by created_at asc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    tempo: Number(row.tempo),
    beatsPerBar: Number(row.beatsPerBar),
    key: row.key == null ? null : String(row.key),
    leadBeats: Number(row.leadBeats),
    slipBars: Number(row.slipBars),
    lyrics: String(row.lyrics ?? ""),
  }));
}

function showDate(value: unknown) {
  const parts = value instanceof Date
    ? [value.getFullYear(), value.getMonth() + 1, value.getDate()]
    : String(value).slice(0, 10).split("-").map(Number);
  const [year, monthNumber, dayNumber] = parts;
  const date = new Date(Date.UTC(year, monthNumber - 1, dayNumber));
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date).toUpperCase();
  const dateKey = `${year}-${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return { month, day: String(dayNumber), dateLabel, dateKey };
}
