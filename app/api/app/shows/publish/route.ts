import { ensureOrganizationTables } from "../../../../(main)/organization/queries";
import { notifyPublishedShow } from "../../../../(main)/organization/notify";
import { readAccountByToken } from "../../../../auth/queries";
import { getSql } from "../../../../db";
import { appError } from "../../account";
import { defaultMix, storedMix } from "../../../../shows/mix";
import { publishableSongs } from "../../../../shows/publication";
import { defaultStage, storedStage } from "../../../../shows/stage";
import { parseCues, parseSections } from "../../../../shows/structure";
import type { Song, SongMix, SongStage } from "../../../../shows/types";

const showIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const account = await readAccountByToken(token);
  if (!account) return appError("Sign in required.", 401);
  const body = await readJson(request);
  const placeId = text(body.placeId);
  if (!showIdPattern.test(placeId)) return appError("Choose an organization to publish to the website.", 400);
  await ensureOrganizationTables();
  const sql = getSql();
  const seats = await sql`
    select role
    from seats
    where account_id = ${account.id}
      and organization_id = ${placeId}
      and (invited_at is null or accepted_at is not null)
      and role in ('Owner', 'Music director')
    limit 1
  `;
  if (!seats[0]) return appError("This seat can't publish.", 403);
  const songs = cleanSongs(body.songs);
  if (songs.length === 0) return appError("Add a song before publishing.", 400);
  const title = text(body.title).slice(0, 120) || "Show";
  const performedOn = dateText(body.performedOn);
  const requested = text(body.showId);
  let showId = showIdPattern.test(requested) ? requested : "";
  if (showId) {
    const existing = await sql`
      select organization_id as "organizationId"
      from shows
      where id = ${showId}
      limit 1
    `;
    const owner = existing[0]?.organizationId ? String(existing[0].organizationId) : "";
    if (!existing[0] || (owner && owner !== placeId)) showId = "";
  }
  if (!showId) {
    const created = await sql`
      insert into shows (title, performed_on, organization_id)
      values (${title}, ${performedOn}::date, ${placeId})
      returning id
    `;
    showId = String(created[0].id);
  } else {
    await sql`
      update shows
      set title = ${title}, performed_on = ${performedOn}::date, organization_id = ${placeId}
      where id = ${showId}
    `;
  }
  const current = await sql`
    select id, title, stem_key as "stemKey", guide_key as "guideKey", track_keys as "trackKeys", mix, stage
    from songs
    where show_id = ${showId}
    order by position asc, created_at asc
  `;
  const used = new Set<string>();
  const stored: Song[] = [];
  for (let position = 0; position < songs.length; position += 1) {
    const song = songs[position];
    const match = current.find((row) => String(row.title) === song.title && !used.has(String(row.id)));
    const stageValue = match ? storedStage(match.stage) : defaultStage();
    stageValue.pitch = song.pitch;
    const mixValue = match ? storedMix(match.mix) : defaultMix();
    const mix = JSON.stringify(mixValue);
    const stage = JSON.stringify(stageValue);
    const sections = JSON.stringify(song.sections);
    const cues = JSON.stringify(song.cues);
    if (match) {
      used.add(String(match.id));
      await sql`
        update songs
        set title = ${song.title},
            tempo = ${song.tempo},
            beats_per_bar = ${song.beatsPerBar},
            key = ${song.key},
            lead_beats = ${song.leadBeats},
            slip_bars = ${song.slipBars},
            lyrics = ${song.lyrics},
            sections = ${sections}::jsonb,
            cues = ${cues}::jsonb,
            mix = ${mix}::jsonb,
            stage = ${stage}::jsonb,
            position = ${position}
        where id = ${match.id}
      `;
      stored.push(songRecord(String(match.id), song, match.stemKey, match.guideKey, match.trackKeys, mixValue, stageValue, position));
    } else {
      const inserted = await sql`
        insert into songs (
          show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics, sections, cues, mix, stage, position
        )
        values (
          ${showId}, ${song.title}, ${song.tempo}, ${song.beatsPerBar}, ${song.key},
          ${song.leadBeats}, ${song.slipBars}, ${song.lyrics}, ${sections}::jsonb, ${cues}::jsonb,
          ${mix}::jsonb, ${stage}::jsonb, ${position}
        )
        returning id
      `;
      stored.push(songRecord(String(inserted[0].id), song, null, null, [], mixValue, stageValue, position));
    }
  }
  for (const row of current) {
    if (!used.has(String(row.id))) await sql`delete from songs where id = ${row.id}`;
  }
  const snapshot = { songs: publishableSongs(stored) };
  const stamped = await sql`
    update shows
    set published_at = now(), published_snapshot = ${JSON.stringify(snapshot)}::jsonb
    where id = ${showId}
    returning published_at::text as "publishedAt"
  `;
  if (!stamped[0]) return appError("That show didn't publish.", 500);
  try {
    await notifyPublishedShow(showId, placeId);
  } catch {
    return Response.json({ showId }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ showId }, { headers: { "Cache-Control": "no-store" } });
}

function songRecord(
  id: string,
  song: CleanSong,
  stemKey: unknown,
  guideKey: unknown,
  trackKeys: unknown,
  mix: SongMix,
  stage: SongStage,
  position: number,
): Song {
  return {
    id,
    title: song.title,
    tempo: song.tempo,
    beatsPerBar: song.beatsPerBar,
    key: song.key,
    leadBeats: song.leadBeats,
    slipBars: song.slipBars,
    lyrics: song.lyrics,
    sections: song.sections,
    cues: song.cues,
    stemKey: stemKey == null ? null : String(stemKey),
    guideKey: guideKey == null ? null : String(guideKey),
    trackKeys: arrayText(trackKeys),
    mix,
    stage,
    position,
  };
}

type CleanSong = {
  title: string;
  tempo: number;
  beatsPerBar: number;
  key: string | null;
  leadBeats: number;
  slipBars: number;
  lyrics: string;
  pitch: number;
  sections: Song["sections"];
  cues: Song["cues"];
};

function cleanSongs(value: unknown): CleanSong[] {
  if (!Array.isArray(value)) return [];
  const songs: CleanSong[] = [];
  for (const item of value.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = text(row.title).slice(0, 120);
    const tempo = Number(row.tempo);
    const beats = Number(row.beatsPerBar);
    if (!title || !Number.isFinite(tempo) || tempo < 20 || tempo > 400) continue;
    if (!Number.isInteger(beats) || beats < 1 || beats > 16) continue;
    const sections = parseSections(row.sections);
    songs.push({
      title,
      tempo,
      beatsPerBar: beats,
      key: cleanKey(row.key),
      leadBeats: Number.isFinite(Number(row.leadBeats)) ? Math.min(Math.max(Number(row.leadBeats), 0), 64) : 0,
      slipBars: Number.isInteger(Number(row.slipBars)) ? Math.min(Math.max(Number(row.slipBars), 0), 32) : 0,
      lyrics: text(row.lyrics).slice(0, 8000),
      pitch: Number.isInteger(Number(row.pitch)) ? Math.min(Math.max(Number(row.pitch), -12), 12) : 0,
      sections: sections.length > 0 ? sections : [{ name: "Song", bars: 1, sourceIndex: null, sourceStartBar: null, sourceBars: null }],
      cues: parseCues(row.cues).slice(0, 200),
    });
  }
  return songs;
}

function cleanKey(value: unknown) {
  const key = text(value);
  if (!key || key.length > 8) return null;
  return key;
}

function arrayText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

function dateText(value: unknown) {
  const date = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date().toISOString().slice(0, 10);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

async function readJson(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
