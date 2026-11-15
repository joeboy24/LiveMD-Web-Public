import { getSql } from "../db";
import { storedMix } from "./mix";
import { publishedShow, snapshotSongs } from "./publication";
import { parseCues, parseSections } from "./structure";
import type { PublishedShow, Show, Song } from "./types";

export async function listShows(): Promise<Show[]> {
  const sql = getSql();
  const rows = await sql`
    select
      shows.id,
      shows.title,
      shows.performed_on as "performedOn",
      shows.published_at is not null as published,
      count(songs.id)::int as "songCount"
    from shows
    left join songs on songs.show_id = shows.id
    group by shows.id
    order by shows.performed_on desc, shows.created_at desc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    songCount: Number(row.songCount),
    published: row.published === true,
    ...showDate(row.performedOn),
  }));
}

export async function showPublication(showId: string): Promise<PublishedShow | null> {
  const sql = getSql();
  const rows = await sql`
    select title, performed_on::text as "performedOn", published_at::text as "publishedAt", published_snapshot as snapshot
    from shows
    where id = ${showId}
  `;
  const row = rows[0];
  const songs = row ? snapshotSongs(row.snapshot) : null;
  if (!row?.publishedAt || !songs) return null;
  return publishedShow(
    {
      id: showId,
      title: String(row.title),
      performedOn: String(row.performedOn).slice(0, 10),
      publishedAt: String(row.publishedAt),
    },
    songs,
  );
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
      lyrics,
      sections,
      cues,
      stem_key as "stemKey",
      guide_key as "guideKey",
      track_keys as "trackKeys",
      mix,
      position
    from songs
    where show_id = ${showId}
    order by position asc, created_at asc
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
    stemKey: row.stemKey == null ? null : String(row.stemKey),
    guideKey: row.guideKey == null ? null : String(row.guideKey),
    trackKeys: trackKeysFrom(row.trackKeys),
    sections: parseSections(row.sections),
    cues: parseCues(row.cues),
    mix: storedMix(row.mix),
    position: Number(row.position),
  }));
}

function trackKeysFrom(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
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
