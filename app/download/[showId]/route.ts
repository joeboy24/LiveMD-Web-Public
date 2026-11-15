import { connection } from "next/server";
import { getSql } from "../../db";
import { snapshotSongs } from "../../shows/publication";

export async function GET(_request: Request, context: { params: Promise<{ showId: string }> }) {
  await connection();
  const { showId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(showId)) return new Response(null, { status: 404 });

  const sql = getSql();
  const rows = await sql`
    select title, performed_on::text as "performedOn", published_at::text as "publishedAt", published_snapshot as snapshot
    from shows
    where id = ${showId}
  `;
  const row = rows[0];
  const songs = row ? snapshotSongs(row.snapshot) : null;
  if (!row?.publishedAt || !songs) return new Response(null, { status: 404 });

  const body = JSON.stringify({
    id: showId,
    title: String(row.title),
    performedOn: String(row.performedOn).slice(0, 10),
    publishedAt: String(row.publishedAt),
    songs,
  });
  const filename = `${fileName(String(row.title))}.json`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function fileName(title: string) {
  const clean = title.replace(/[^\w.-]+/g, " ").trim();
  return clean || "show";
}
