import { checkPassword, hashPassword } from "../../../auth/password";
import { readAccountSecret, replaceAccountPassword } from "../../../auth/queries";
import { appError, cleanPassword, readAppAccount } from "../account";

export async function POST(request: Request) {
  const account = await readAppAccount(request);
  if (!account) return appError("Sign in required.", 401);
  const body = await readJson(request);
  const current = cleanPassword(body.current);
  const next = cleanPassword(body.next);
  if (!current) return appError("Enter your current password.", 400);
  if (next.length < 8) return appError("Use at least 8 characters.", 400);
  if (current === next) return appError("Choose a different password.", 400);
  const secret = await readAccountSecret(account.id);
  if (!secret || !(await checkPassword(current, secret))) return appError("That password is wrong.", 400);
  await replaceAccountPassword(account.id, await hashPassword(next));
  return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
}

async function readJson(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
