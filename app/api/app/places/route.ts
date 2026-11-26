import { ensureOrganizationTables } from "../../../(main)/organization/queries";
import { planAccent } from "../../../(main)/organization/sample";
import { attachSeats, readAccountByToken } from "../../../auth/queries";
import { getSql } from "../../../db";
import { appError } from "../account";

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const account = await readAccountByToken(token);
  if (!account) return appError("Sign in required.", 401);
  await ensureOrganizationTables();
  await attachSeats(account.email.toLowerCase(), account.id);
  const sql = getSql();
  const rows = await sql`
    select organizations.id, organizations.name, organizations.plan, organizations.plan_until as "planUntil", seats.role
    from seats
    join organizations on organizations.id = seats.organization_id
    where seats.account_id = ${account.id}
      and seats.disabled_at is null
      and (seats.invited_at is null or seats.accepted_at is not null)
    order by organizations.name asc
  `;
  const places = [
    { id: "personal", name: "Personal", detail: "Your own copy", plan: "Personal", color: "076FBF" },
    ...rows.map((row) => {
      const plan = livePlan(String(row.plan ?? "Personal"), row.planUntil);
      return {
        id: String(row.id),
        name: String(row.name),
        detail: String(row.role ?? "Member"),
        plan,
        color: planAccent(plan).replace("#", ""),
      };
    }),
  ];
  return Response.json({ places }, { headers: { "Cache-Control": "no-store" } });
}

function livePlan(plan: string, until: unknown) {
  const name = plan || "Personal";
  if (!until) return name;
  const time = new Date(String(until)).getTime();
  if (!Number.isFinite(time) || time > Date.now()) return name;
  return "Personal";
}
