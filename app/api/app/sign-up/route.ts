import { cleanEmail, cleanName, cleanPassword, cleanPhone, appError, signUpApp } from "../account";

export async function POST(request: Request) {
  const body = await readBody(request);
  const typedPhone = String(body.phone ?? "").trim();
  const phone = cleanPhone(body.phone);
  if (typedPhone && !phone) return appError("Enter a phone number.", 400);
  return signUpApp(cleanName(body.name), cleanEmail(body.email), cleanPassword(body.password), phone);
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as { name?: unknown; email?: unknown; password?: unknown; phone?: unknown };
  } catch {
    return {};
  }
}
