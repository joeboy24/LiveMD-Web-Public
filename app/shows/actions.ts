"use server";

import { revalidatePath } from "next/cache";
import { getSql } from "../db";
import type { FormState, ShowSnapshot, Song } from "./types";

export async function createShow(_state: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const performedOn = String(formData.get("performedOn") ?? "").trim();
  if (!title) return { error: "Enter a show name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(performedOn)) return { error: "Choose a performance date." };

  const sql = getSql();
  const rows = await sql`
    insert into shows (title, performed_on)
    values (${title}, ${performedOn}::date)
    returning id, title, performed_on::text as "performedOn"
  `;
  revalidatePath("/", "layout");
  const row = rows[0];
  return {
    error: null,
    saved: true,
    show: {
      id: String(row.id),
      title: String(row.title),
      performedOn: String(row.performedOn).slice(0, 10),
      songs: [],
    },
  };
}

export async function createSong(showId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const lyrics = String(formData.get("lyrics") ?? "");
  const tempo = numberValue(formData.get("tempo"));
  const beatsPerBar = numberValue(formData.get("beatsPerBar")) ?? 4;
  const leadBeats = optionalNumber(formData.get("leadBeats"));
  const slipBars = optionalNumber(formData.get("slipBars"));

  if (!title) return { error: "A song needs a title." };
  if (tempo == null || tempo <= 0) return { error: "Tempo has to be greater than zero." };
  if (!Number.isInteger(beatsPerBar) || beatsPerBar < 1) {
    return { error: "Beats per bar has to be a whole number." };
  }
  if (leadBeats == null || leadBeats < 0) return { error: "Lead beats cannot be negative." };
  if (slipBars == null || !Number.isInteger(slipBars) || slipBars < 0) {
    return { error: "Slip has to be a whole number of bars." };
  }

  const sql = getSql();
  const rows = await sql`
    insert into songs (show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics)
    values (
      ${showId},
      ${title},
      ${tempo},
      ${beatsPerBar},
      ${key || null},
      ${leadBeats},
      ${slipBars},
      ${lyrics}
    )
    returning id, title, tempo, beats_per_bar as "beatsPerBar", key, lead_beats as "leadBeats", slip_bars as "slipBars", lyrics
  `;
  revalidatePath("/", "layout");
  return { error: null, saved: true, song: songFromRow(rows[0]) };
}

export async function restoreSong(showId: string, song: Song) {
  const sql = getSql();
  await sql`
    insert into songs (id, show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics)
    values (
      ${song.id},
      ${showId},
      ${song.title},
      ${song.tempo},
      ${song.beatsPerBar},
      ${song.key},
      ${song.leadBeats},
      ${song.slipBars},
      ${song.lyrics}
    )
  `;
  revalidatePath("/", "layout");
}

export async function deleteShow(showId: string): Promise<ShowSnapshot | null> {
  const sql = getSql();
  const shows = await sql`
    select id, title, performed_on::text as "performedOn"
    from shows
    where id = ${showId}
  `;
  const show = shows[0];
  if (!show) return null;
  const songs = await sql`
    select
      id,
      title,
      tempo,
      beats_per_bar as "beatsPerBar",
      key,
      lead_beats as "leadBeats",
      slip_bars as "slipBars",
      lyrics,
      created_at::text as "createdAt"
    from songs
    where show_id = ${showId}
    order by created_at asc
  `;
  await sql`
    with removed_songs as (
      delete from songs where show_id = ${showId}
    )
    delete from shows where id = ${showId}
  `;
  revalidatePath("/", "layout");
  return {
    id: String(show.id),
    title: String(show.title),
    performedOn: String(show.performedOn).slice(0, 10),
    songs: songs.map((row) => ({ ...songFromRow(row), createdAt: String(row.createdAt) })),
  };
}

export async function restoreShow(show: ShowSnapshot) {
  const sql = getSql();
  await sql`
    insert into shows (id, title, performed_on)
    values (${show.id}, ${show.title}, ${show.performedOn}::date)
  `;
  for (const song of show.songs) {
    await sql`
      insert into songs (id, show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics, created_at)
      values (
        ${song.id},
        ${show.id},
        ${song.title},
        ${song.tempo},
        ${song.beatsPerBar},
        ${song.key},
        ${song.leadBeats},
        ${song.slipBars},
        ${song.lyrics},
        ${song.createdAt}::timestamptz
      )
    `;
  }
  revalidatePath("/", "layout");
}

export async function deleteSong(songId: string) {
  const sql = getSql();
  await sql`delete from songs where id = ${songId}`;
  revalidatePath("/", "layout");
}

function songFromRow(row: Record<string, unknown>): Song {
  return {
    id: String(row.id),
    title: String(row.title),
    tempo: Number(row.tempo),
    beatsPerBar: Number(row.beatsPerBar),
    key: row.key == null ? null : String(row.key),
    leadBeats: Number(row.leadBeats),
    slipBars: Number(row.slipBars),
    lyrics: String(row.lyrics ?? ""),
  };
}

function numberValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return 0;
  return numberValue(value);
}
