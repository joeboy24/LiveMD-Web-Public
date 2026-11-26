import { ensureOrganizationTables } from "../../../../(main)/organization/queries";
import { readAccountByToken } from "../../../../auth/queries";
import { getSql } from "../../../../db";
import { appError } from "../../account";

const showIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const account = await readAccountByToken(token);
  if (!account) return appError("Sign in required.", 401);
  const body = await readJson(request);
  const placeId = text(body.placeId);
  const showId = text(body.showId);
  if (!showIdPattern.test(placeId)) return appError("Choose an organization to undo the publish.", 400);
  if (!showIdPattern.test(showId)) return appError("That show is not on the website.", 400);
  await ensureOrganizationTables();
  const sql = getSql();
  const seats = await sql`
    select role
    from seats
    where account_id = ${account.id}
      and organization_id = ${placeId}
      and disabled_at is null
      and (invited_at is null or accepted_at is not null)
      and role in ('Owner', 'Music director')
    limit 1
  `;
  if (!seats[0]) return appError("This seat can't undo a publish.", 403);
  const cleared = await sql`
    update shows
    set published_at = null, published_snapshot = null
    where id = ${showId} and organization_id = ${placeId}
    returning id
  `;
  if (!cleared[0]) return appError("That show isn't published for this organization.", 404);
  return Response.json({ showId }, { headers: { "Cache-Control": "no-store" } });
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
