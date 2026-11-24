import { ensureOrganizationTables } from "../../../(main)/organization/queries";
import { readAccountByToken } from "../../../auth/queries";
import { getSql } from "../../../db";
import { appError } from "../account";

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const account = await readAccountByToken(token);
  if (!account) return appError("Sign in required.", 401);
  await ensureOrganizationTables();
  const sql = getSql();
  const rows = await sql`
    select organizations.id, organizations.name, seats.role
    from seats
    join organizations on organizations.id = seats.organization_id
    where seats.account_id = ${account.id}
      and (seats.invited_at is null or seats.accepted_at is not null)
    order by organizations.name asc
  `;
  const places = [
    { id: "personal", name: "Personal", detail: "Your own copy" },
    ...rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      detail: String(row.role ?? "Member"),
    })),
  ];
  return Response.json({ places }, { headers: { "Cache-Control": "no-store" } });
}
