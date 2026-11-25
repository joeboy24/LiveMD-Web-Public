import { connection } from "next/server";
import { getSql } from "../../../../db";
import { showZip } from "../../../../shows/offline-zip";
import { showVisible } from "../../../../shows/queries";
import { appError, readAppAccount } from "../../account";
import { layersFor, packageForSeat, seatInPlace, showIdPattern } from "../access";

export async function GET(request: Request, context: { params: Promise<{ showId: string }> }) {
  await connection();
  const account = await readAppAccount(request);
  if (!account) return appError("Sign in required.", 401);
  const { showId } = await context.params;
  const placeId = new URL(request.url).searchParams.get("placeId") ?? "";
  if (!showIdPattern.test(showId) || !showIdPattern.test(placeId)) {
    return appError("Choose an organization to download a published show.", 400);
  }
  const seat = await seatInPlace(account.id, placeId);
  if (!seat) return appError("This seat can't download shows for that organization.", 403);
  const sql = getSql();
  const rows = await sql`
    select title, performed_on::text as "performedOn", published_at::text as "publishedAt",
      organization_id as "organizationId", published_snapshot as snapshot,
      audience, audience_role as "audienceRole", audience_group_id as "audienceGroupId",
      audience_roles as "audienceRoles", audience_group_ids as "audienceGroupIds"
    from shows
    where id = ${showId}
    limit 1
  `;
  const row = rows[0];
  if (!row || String(row.organizationId ?? "") !== placeId || !row.publishedAt || !showVisible(row, seat)) {
    return appError("That show isn't published for this seat.", 404);
  }
  const pack = packageForSeat(row.snapshot, layersFor(seat.role));
  if (!pack) return appError("That show has no audio to download.", 404);
  const bytes = await showZip(
    {
      id: showId,
      title: String(row.title),
      performedOn: String(row.performedOn),
    },
    pack,
  );
  if (!bytes) return appError("The show could not be downloaded. Try again when the connection is back.", 500);
  const name = fileName(String(row.title));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}.zip"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
    },
  });
}

function fileName(title: string) {
  const clean = title.replace(/[^\w.-]+/g, " ").trim();
  return clean || "show";
}
