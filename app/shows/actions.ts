"use server";

import { revalidatePath } from "next/cache";
import { getSql } from "../db";
import { parseCues, parseSections } from "./structure";
import { ownedAudioKey, signAudioRead, signAudioUpload } from "./storage";
import type { FormState, ShowSnapshot, Song, SongCue, SongSection } from "./types";

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
  const stemKey = ownedAudioKey(showId, formData.get("stemKey"));
  const guideKey = ownedAudioKey(showId, formData.get("guideKey"));
  const trackKey = ownedAudioKey(showId, formData.get("trackKey"));
  if (stemKey === undefined || guideKey === undefined || trackKey === undefined) {
    return { error: "That audio file didn't upload." };
  }
  const trackKeys = trackKey ? [trackKey] : [];

  const sql = getSql();
  const rows = await sql`
    insert into songs (
      show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics, stem_key, guide_key, track_keys
    )
    values (
      ${showId},
      ${title},
      ${tempo},
      ${beatsPerBar},
      ${key || null},
      ${leadBeats},
      ${slipBars},
      ${lyrics},
      ${stemKey},
      ${guideKey},
      ${JSON.stringify(trackKeys)}::jsonb
    )
    returning
      id, title, tempo, beats_per_bar as "beatsPerBar", key, lead_beats as "leadBeats",
      slip_bars as "slipBars", lyrics, stem_key as "stemKey", guide_key as "guideKey", track_keys as "trackKeys"
  `;
  revalidatePath("/", "layout");
  return { error: null, saved: true, song: songFromRow(rows[0]) };
}

export async function restoreSong(showId: string, song: Song) {
  const sql = getSql();
  await sql`
    insert into songs (
      id, show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics,
      stem_key, guide_key, track_keys, sections, cues
    )
    values (
      ${song.id},
      ${showId},
      ${song.title},
      ${song.tempo},
      ${song.beatsPerBar},
      ${song.key},
      ${song.leadBeats},
      ${song.slipBars},
      ${song.lyrics},
      ${song.stemKey},
      ${song.guideKey},
      ${JSON.stringify(song.trackKeys ?? [])}::jsonb,
      ${JSON.stringify(song.sections ?? [])}::jsonb,
      ${JSON.stringify(song.cues ?? [])}::jsonb
    )
  `;
  revalidatePath("/", "layout");
}

export async function signUpload(input: { showId: string; fileName: string; contentType: string; size: number }) {
  return signAudioUpload(input.showId, input.fileName, input.contentType, Number(input.size));
}

export async function readAudio(showId: string, key: string) {
  return signAudioRead(showId, key);
}

export async function saveArrangement(
  showId: string,
  songId: string,
  sections: SongSection[],
  cues: SongCue[],
  leadBeats: number,
  slipBars: number,
  lyrics: string,
) {
  const cleanSections = parseSections(sections);
  const cleanCues = parseCues(cues);
  if (!cleanSections.length || cleanSections.length !== sections.length || cleanCues.length !== cues.length) {
    return { error: "Those sections didn't save." };
  }
  if (cleanSections.length > 80 || cleanCues.length > 200) return { error: "That arrangement is too long." };
  if (!Number.isFinite(leadBeats) || !Number.isInteger(slipBars) || slipBars < 0 || slipBars > 80) {
    return { error: "Those sections didn't save." };
  }

  const sql = getSql();
  const rows = await sql`
    update songs
    set sections = ${JSON.stringify(cleanSections)}::jsonb,
        cues = ${JSON.stringify(cleanCues)}::jsonb,
        lead_beats = ${leadBeats},
        slip_bars = ${slipBars},
        lyrics = ${lyrics.slice(0, 20000)}
    where id = ${songId} and show_id = ${showId}
    returning id
  `;
  if (!rows[0]) return { error: "That song is missing." };
  revalidatePath("/", "layout");
  return { error: null as string | null };
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
      sections,
      cues,
      stem_key as "stemKey",
      guide_key as "guideKey",
      track_keys as "trackKeys",
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
      insert into songs (
        id, show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics,
        stem_key, guide_key, track_keys, sections, cues, created_at
      )
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
        ${song.stemKey},
        ${song.guideKey},
        ${JSON.stringify(song.trackKeys ?? [])}::jsonb,
        ${JSON.stringify(song.sections ?? [])}::jsonb,
        ${JSON.stringify(song.cues ?? [])}::jsonb,
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
    stemKey: row.stemKey == null ? null : String(row.stemKey),
    guideKey: row.guideKey == null ? null : String(row.guideKey),
    trackKeys: trackKeysFrom(row.trackKeys),
    sections: parseSections(row.sections),
    cues: parseCues(row.cues),
  };
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

function numberValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return 0;
  return numberValue(value);
}
