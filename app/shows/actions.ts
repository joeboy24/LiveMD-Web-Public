"use server";

import { revalidatePath } from "next/cache";
import { getSql } from "../db";
import { storedMix } from "./mix";
import { storedStage, storedTempo } from "./stage";
import { organizationId } from "../organization/queries";
import { listSongs } from "./queries";
import { publishableSongs, publishedShow, snapshotSongs } from "./publication";
import { parseCues, parseSections } from "./structure";
import { ownedAudioKey, signAudioRead, signAudioUpload } from "./storage";
import type { FormState, PublishedShow, ShowSnapshot, Song, SongCue, SongMix, SongSection, SongStage } from "./types";

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
      publishedAt: null,
      publishedSongs: null,
      songs: [],
    },
  };
}

export async function updateShow(showId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const performedOn = String(formData.get("performedOn") ?? "").trim();
  if (!title) return { error: "Enter a show name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(performedOn)) return { error: "Choose a performance date." };
  const updated = await writeShow(showId, title, performedOn);
  if (!updated) return { error: "That show is missing." };
  return { error: null, saved: true };
}

export async function replaceShowDetails(show: { id: string; title: string; performedOn: string }) {
  return writeShow(show.id, show.title, show.performedOn);
}

async function writeShow(showId: string, title: string, performedOn: string) {
  const sql = getSql();
  const rows = await sql`
    update shows
    set title = ${title}, performed_on = ${performedOn}::date
    where id = ${showId}
    returning id
  `;
  if (!rows[0]) return null;
  revalidatePath("/", "layout");
  return { id: showId, title, performedOn };
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
  const placed = await sql`
    select coalesce(max(position), -1) + 1 as position
    from songs
    where show_id = ${showId}
  `;
  const position = Number(placed[0]?.position ?? 0);
  const rows = await sql`
    insert into songs (
      show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics, stem_key, guide_key, track_keys, position
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
      ${JSON.stringify(trackKeys)}::jsonb,
      ${position}
    )
    returning
      id, title, tempo, beats_per_bar as "beatsPerBar", key, lead_beats as "leadBeats",
      slip_bars as "slipBars", lyrics, stem_key as "stemKey", guide_key as "guideKey", track_keys as "trackKeys",
      position
  `;
  revalidatePath("/", "layout");
  return { error: null, saved: true, song: songFromRow(rows[0]) };
}

export async function updateSong(showId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const songId = String(formData.get("songId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const lyrics = String(formData.get("lyrics") ?? "");
  const tempo = numberValue(formData.get("tempo"));
  if (!songId) return { error: "That song is missing." };
  if (!title) return { error: "A song needs a title." };
  if (tempo == null || tempo <= 0) return { error: "Tempo has to be greater than zero." };

  const sql = getSql();
  const current = await sql`
    select stem_key as "stemKey", guide_key as "guideKey", track_keys as "trackKeys"
    from songs
    where id = ${songId} and show_id = ${showId}
  `;
  if (!current[0]) return { error: "That song is missing." };
  const stem = audioChoice(showId, formData.get("stemKey"), current[0].stemKey);
  const guide = audioChoice(showId, formData.get("guideKey"), current[0].guideKey);
  const tracks = trackChoice(showId, formData.get("trackKey"), current[0].trackKeys);
  if (stem === undefined || guide === undefined || tracks === undefined) {
    return { error: "That audio file didn't upload." };
  }
  const song = await writeSongDetails(showId, songId, {
    title,
    tempo,
    key: key || null,
    lyrics,
    stemKey: stem,
    guideKey: guide,
    trackKeys: tracks,
  });
  if (!song) return { error: "That song is missing." };
  return { error: null, saved: true, song };
}

export async function replaceSongDetails(
  showId: string,
  song: Pick<Song, "id" | "title" | "tempo" | "key" | "lyrics" | "stemKey" | "guideKey" | "trackKeys">,
) {
  return writeSongDetails(showId, song.id, {
    title: song.title,
    tempo: song.tempo,
    key: song.key,
    lyrics: song.lyrics,
    stemKey: song.stemKey,
    guideKey: song.guideKey,
    trackKeys: song.trackKeys,
  });
}

async function writeSongDetails(
  showId: string,
  songId: string,
  details: {
    title: string;
    tempo: number;
    key: string | null;
    lyrics: string;
    stemKey: string | null;
    guideKey: string | null;
    trackKeys: string[];
  },
) {
  const sql = getSql();
  const rows = await sql`
    update songs
    set title = ${details.title},
        tempo = ${details.tempo},
        key = ${details.key},
        lyrics = ${details.lyrics},
        stem_key = ${details.stemKey},
        guide_key = ${details.guideKey},
        track_keys = ${JSON.stringify(details.trackKeys)}::jsonb
    where id = ${songId} and show_id = ${showId}
    returning
      id, title, tempo, beats_per_bar as "beatsPerBar", key, lead_beats as "leadBeats",
      slip_bars as "slipBars", lyrics, stem_key as "stemKey", guide_key as "guideKey", track_keys as "trackKeys",
      sections, cues, mix, stage, position
  `;
  if (!rows[0]) return null;
  revalidatePath("/", "layout");
  return songFromRow(rows[0]);
}

function audioChoice(showId: string, uploaded: FormDataEntryValue | null, current: unknown) {
  const next = String(uploaded ?? "").trim();
  if (!next) return current == null || current === "" ? null : String(current);
  return ownedAudioKey(showId, next);
}

function trackChoice(showId: string, uploaded: FormDataEntryValue | null, current: unknown) {
  const tracks = trackKeysFrom(current);
  const next = String(uploaded ?? "").trim();
  if (!next) return tracks;
  const owned = ownedAudioKey(showId, next);
  if (!owned) return undefined;
  return tracks.length === 0 ? [owned] : [owned, ...tracks.slice(1)];
}

export async function restoreSong(showId: string, song: Song) {
  const sql = getSql();
  const position = Number.isInteger(song.position) ? song.position : 0;
  await sql`
    update songs
    set position = position + 1
    where show_id = ${showId} and position >= ${position}
  `;
  await sql`
    insert into songs (
      id, show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics,
      stem_key, guide_key, track_keys, sections, cues, mix, stage, position
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
      ${JSON.stringify(song.cues ?? [])}::jsonb,
      ${JSON.stringify(storedMix(song.mix))}::jsonb,
      ${JSON.stringify(storedStage(song.stage))}::jsonb,
      ${position}
    )
  `;
  revalidatePath("/", "layout");
}

export async function orderSongs(showId: string, ids: string[]) {
  const sql = getSql();
  const rows = await sql`select id from songs where show_id = ${showId}`;
  const owned = rows.map((row) => String(row.id));
  if (ids.length !== owned.length || ids.some((id) => !owned.includes(id))) {
    return { error: "That song order didn't save." };
  }
  for (let index = 0; index < ids.length; index += 1) {
    await sql`update songs set position = ${index} where id = ${ids[index]} and show_id = ${showId}`;
  }
  revalidatePath("/", "layout");
  return { error: null as string | null };
}

export async function signUpload(input: { showId: string; fileName: string; contentType: string; size: number }) {
  return signAudioUpload(input.showId, input.fileName, input.contentType, Number(input.size));
}

export async function readAudio(showId: string, key: string) {
  return signAudioRead(showId, key);
}

export async function saveStemLayers(showId: string, songId: string, trackKeys: string[], guideKey: string | null) {
  if (trackKeys.length > 16) return { error: "That arrangement is too long." };
  const tracks: string[] = [];
  for (const key of trackKeys) {
    const owned = ownedAudioKey(showId, key);
    if (!owned) return { error: "That track is missing." };
    tracks.push(owned);
  }
  const guide = guideKey ? ownedAudioKey(showId, guideKey) : null;
  if (guideKey && !guide) return { error: "That track is missing." };
  const sql = getSql();
  const rows = await sql`
    update songs
    set track_keys = ${JSON.stringify(tracks)}::jsonb,
        guide_key = ${guide}
    where id = ${songId} and show_id = ${showId}
    returning id
  `;
  if (!rows[0]) return { error: "That song is missing." };
  revalidatePath("/", "layout");
  return { error: null as string | null };
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

export async function saveStage(showId: string, songId: string, tempo: number, stage: SongStage) {
  const cleanTempo = storedTempo(tempo);
  const clean = storedStage(stage);
  const sql = getSql();
  const rows = await sql`
    update songs
    set tempo = ${cleanTempo},
        stage = ${JSON.stringify(clean)}::jsonb
    where id = ${songId} and show_id = ${showId}
    returning id
  `;
  if (!rows[0]) return { error: "That song is missing." };
  revalidatePath("/", "layout");
  return { error: null as string | null };
}

export async function saveMix(showId: string, songId: string, mix: SongMix) {
  const clean = storedMix(mix);
  const sql = getSql();
  const rows = await sql`
    update songs
    set mix = ${JSON.stringify(clean)}::jsonb
    where id = ${songId} and show_id = ${showId}
    returning id
  `;
  if (!rows[0]) return { error: "That song is missing." };
  revalidatePath("/", "layout");
  return { error: null as string | null };
}

export async function publishShow(showId: string): Promise<{ error: string | null; publication?: PublishedShow }> {
  const sql = getSql();
  const shows = await sql`
    select id, title, performed_on::text as "performedOn"
    from shows
    where id = ${showId}
  `;
  const show = shows[0];
  if (!show) return { error: "That show is missing." };
  const songs = publishableSongs(await listSongs(showId));
  const snapshot = { songs };
  const rows = await sql`
    update shows
    set published_at = now(),
        published_snapshot = ${JSON.stringify(snapshot)}::jsonb
    where id = ${showId}
    returning published_at::text as "publishedAt"
  `;
  const publishedAt = rows[0]?.publishedAt;
  if (!publishedAt) return { error: "That show didn't publish." };
  revalidatePath("/", "layout");
  return {
    error: null,
    publication: publishedShow(
      {
        id: showId,
        title: String(show.title),
        performedOn: String(show.performedOn).slice(0, 10),
        publishedAt: String(publishedAt),
      },
      songs,
    ),
  };
}

export async function deleteShow(showId: string): Promise<ShowSnapshot | null> {
  const sql = getSql();
  const shows = await sql`
    select id, title, performed_on::text as "performedOn", published_at::text as "publishedAt", published_snapshot as "publishedSnapshot"
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
      mix,
      stage,
      position,
      created_at::text as "createdAt"
    from songs
    where show_id = ${showId}
    order by position asc, created_at asc
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
    publishedAt: show.publishedAt == null ? null : String(show.publishedAt),
    publishedSongs: snapshotSongs(show.publishedSnapshot),
    songs: songs.map((row) => ({ ...songFromRow(row), createdAt: String(row.createdAt) })),
  };
}

export async function restoreShow(show: ShowSnapshot) {
  const sql = getSql();
  const snapshot = show.publishedSongs ? JSON.stringify({ songs: show.publishedSongs }) : null;
  await sql`
    insert into shows (id, title, performed_on, published_at, published_snapshot)
    values (
      ${show.id},
      ${show.title},
      ${show.performedOn}::date,
      ${show.publishedAt}::timestamptz,
      ${snapshot}::jsonb
    )
  `;
  for (const song of show.songs) {
    await sql`
      insert into songs (
        id, show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics,
        stem_key, guide_key, track_keys, sections, cues, mix, stage, position, created_at
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
        ${JSON.stringify(storedMix(song.mix))}::jsonb,
        ${JSON.stringify(storedStage(song.stage))}::jsonb,
        ${song.position},
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
    mix: storedMix(row.mix),
    stage: storedStage(row.stage),
    position: Number(row.position ?? 0),
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
