import { ensureOrganizationTables, type SeatAudience } from "../../../(main)/organization/queries";
import { accessFor, type AudioLayer } from "../../../auth/access";
import { getSql } from "../../../db";
import { showVisible } from "../../../shows/queries";
import { offlinePackage, snapshotSongs } from "../../../shows/publication";

export const showIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function seatInPlace(accountId: string, placeId: string): Promise<SeatAudience | null> {
  await ensureOrganizationTables();
  const sql = getSql();
  const seats = await sql`
    select id, role
    from seats
    where account_id = ${accountId}
      and organization_id = ${placeId}
      and disabled_at is null
      and (invited_at is null or accepted_at is not null)
    limit 1
  `;
  const seat = seats[0];
  if (!seat) return null;
  const role = String(seat.role ?? "");
  const seesAll = role === "Owner" || role === "Music director";
  if (seesAll) return { role, seatId: String(seat.id), seesAll, groupIds: [] };
  const groups = await sql`select group_id from group_seats where seat_id = ${seat.id}`;
  return {
    role,
    seatId: String(seat.id),
    seesAll,
    groupIds: groups.map((row) => String(row.group_id)),
  };
}

export function packageForSeat(value: unknown, layers: readonly AudioLayer[]) {
  if (!layers.includes("stem")) return null;
  const songs = snapshotSongs(value);
  if (!songs) return null;
  const shaped = songs.map((song) => ({
    ...song,
    guideKey: layers.includes("guide") ? song.guideKey : null,
    trackKeys: layers.includes("track") ? song.trackKeys : [],
  }));
  const pack = offlinePackage(shaped);
  if (!pack || pack.songs.length === 0) return null;
  return pack;
}

export function layersFor(role: string) {
  return accessFor(role, true).layers;
}

export function publishedRows(rows: Record<string, unknown>[], seat: SeatAudience) {
  return rows.flatMap((row) => {
    if (!showVisible(row, seat)) return [];
    const pack = packageForSeat(row.snapshot, layersFor(seat.role));
    if (!pack) return [];
    return [
      {
        id: String(row.id),
        title: String(row.title),
        performedOn: String(row.performedOn).slice(0, 10),
        songCount: pack.songs.length,
      },
    ];
  });
}
