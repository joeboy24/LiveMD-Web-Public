import { cache } from "react";
import { readSessionAccount } from "../auth/queries";
import { getSql } from "../db";
import { organizationId, readSeatAudience, type SeatAudience } from "../(main)/organization/queries";
import { storedMix } from "./mix";
import { storedStage } from "./stage";
import { offlinePackage, publishedShow, snapshotSongs } from "./publication";
import { parseCues, parseSections } from "./structure";
import type { PublishedShow, Show, Song } from "./types";

export async function listShows(): Promise<Show[]> {
  const sql = getSql();
  const account = await readSessionAccount();
  const orgId = await organizationId();
  if (account && !orgId) return [];
  const rows = account && orgId
    ? await sql`
        select
          shows.id,
          shows.title,
          shows.performed_on as "performedOn",
          shows.published_at is not null as published,
          shows.audience,
          shows.audience_role as "audienceRole",
          shows.audience_group_id as "audienceGroupId",
          shows.audience_roles as "audienceRoles",
          shows.audience_group_ids as "audienceGroupIds",
          count(songs.id)::int as "songCount"
        from shows
        left join songs on songs.show_id = shows.id
        where shows.organization_id is null or shows.organization_id = ${orgId}
        group by shows.id
        order by shows.performed_on desc, shows.created_at desc
      `
    : await sql`
        select
          shows.id,
          shows.title,
          shows.performed_on as "performedOn",
          shows.published_at is not null as published,
          shows.audience,
          shows.audience_role as "audienceRole",
          shows.audience_group_id as "audienceGroupId",
          shows.audience_roles as "audienceRoles",
          shows.audience_group_ids as "audienceGroupIds",
          count(songs.id)::int as "songCount"
        from shows
        left join songs on songs.show_id = shows.id
        group by shows.id
        order by shows.performed_on desc, shows.created_at desc
      `;
  const seat = account ? await readSeatAudience() : null;
  return rows.filter((row) => showVisible(row, seat)).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    songCount: Number(row.songCount),
    published: row.published === true,
    ...audienceFrom(row),
    ...showDate(row.performedOn),
  }));
}

export async function publishedShowRows() {
  const sql = getSql();
  const account = await readSessionAccount();
  const orgId = await organizationId();
  if (account && !orgId) return [];
  const rows = orgId
    ? await sql`
        select id, title, performed_on::text as "performedOn", published_at::text as "publishedAt", published_snapshot as snapshot,
          audience, audience_role as "audienceRole", audience_group_id as "audienceGroupId",
          audience_roles as "audienceRoles", audience_group_ids as "audienceGroupIds"
        from shows
        where published_at is not null
          and (organization_id is null or organization_id = ${orgId})
        order by performed_on desc, created_at desc
      `
    : await sql`
        select id, title, performed_on::text as "performedOn", published_at::text as "publishedAt", published_snapshot as snapshot,
          audience, audience_role as "audienceRole", audience_group_id as "audienceGroupId",
          audience_roles as "audienceRoles", audience_group_ids as "audienceGroupIds"
        from shows
        where published_at is not null
        order by performed_on desc, created_at desc
      `;
  const seat = await readSeatAudience();
  return rows.filter((row) => showVisible(row, seat)).flatMap((row) => {
    const songs = snapshotSongs(row.snapshot);
    const pack = songs ? offlinePackage(songs) : null;
    if (!pack || pack.songs.length === 0) return [];
    return [
      {
        id: String(row.id),
        title: String(row.title),
        performedOn: String(row.performedOn).slice(0, 10),
        publishedAt: String(row.publishedAt),
        songCount: pack.songs.length,
      },
    ];
  });
}

export async function showPublication(showId: string): Promise<PublishedShow | null> {
  const seat = await readSeatAudience();
  const sql = getSql();
  const rows = await sql`
    select title, performed_on::text as "performedOn", published_at::text as "publishedAt", published_snapshot as snapshot,
      audience, audience_role as "audienceRole", audience_group_id as "audienceGroupId",
      audience_roles as "audienceRoles", audience_group_ids as "audienceGroupIds"
    from shows
    where id = ${showId}
  `;
  const row = rows[0];
  if (!row || !showVisible(row, seat)) return null;
  const songs = snapshotSongs(row.snapshot);
  if (!row.publishedAt || !songs) return null;
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
  if (!(await showIsOpen(showId))) return [];
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
      stage,
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
    stage: storedStage(row.stage),
    position: Number(row.position),
  }));
}

type AudienceRow = {
  audience?: unknown;
  audienceRole?: unknown;
  audienceGroupId?: unknown;
  audienceRoles?: unknown;
  audienceGroupIds?: unknown;
};

function textList(value: unknown): string[] {
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

function audienceFrom(row: AudienceRow): Pick<Show, "audienceRoles" | "audienceGroupIds"> {
  const roles = textList(row.audienceRoles);
  const groups = textList(row.audienceGroupIds);
  if (roles.length === 0 && row.audience === "role" && row.audienceRole) roles.push(String(row.audienceRole));
  if (groups.length === 0 && row.audience === "group" && row.audienceGroupId) groups.push(String(row.audienceGroupId));
  return { audienceRoles: roles, audienceGroupIds: groups };
}

export function showVisible(row: AudienceRow, seat: SeatAudience | null) {
  const { audienceRoles, audienceGroupIds } = audienceFrom(row);
  if (audienceRoles.length === 0 && audienceGroupIds.length === 0) return true;
  if (!seat) return false;
  if (seat.seesAll) return true;
  if (audienceRoles.includes(seat.role)) return true;
  return audienceGroupIds.some((id) => seat.groupIds.includes(id));
}

export const showIsOpen = cache(async (showId: string) => {
  const seat = await readSeatAudience();
  const sql = getSql();
  const rows = await sql`
    select audience, audience_role as "audienceRole", audience_group_id as "audienceGroupId",
      audience_roles as "audienceRoles", audience_group_ids as "audienceGroupIds"
    from shows
    where id = ${showId}
  `;
  const row = rows[0];
  if (!row) return false;
  return showVisible(row, seat);
});

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
