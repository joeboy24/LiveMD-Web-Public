import { connection } from "next/server";
import { getSql } from "../../../db";
import { appError, readAppAccount } from "../account";
import { publishedRows, seatInPlace, showIdPattern } from "./access";

export async function GET(request: Request) {
  await connection();
  const account = await readAppAccount(request);
  if (!account) return appError("Sign in required.", 401);
  const placeId = new URL(request.url).searchParams.get("placeId") ?? "";
  if (!showIdPattern.test(placeId)) return appError("Choose an organization to download a published show.", 400);
  const seat = await seatInPlace(account.id, placeId);
  if (!seat) return appError("This seat can't download shows for that organization.", 403);
  const sql = getSql();
  const rows = await sql`
    select id, title, performed_on::text as "performedOn", published_snapshot as snapshot,
      audience, audience_role as "audienceRole", audience_group_id as "audienceGroupId",
      audience_roles as "audienceRoles", audience_group_ids as "audienceGroupIds"
    from shows
    where published_at is not null
      and organization_id = ${placeId}
    order by performed_on desc, created_at desc
  `;
  return Response.json({ shows: publishedRows(rows, seat) }, { headers: { "Cache-Control": "no-store" } });
}
