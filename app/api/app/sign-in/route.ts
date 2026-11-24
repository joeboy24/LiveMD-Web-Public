import { cleanEmail, cleanPassword, signInApp } from "../account";

export async function POST(request: Request) {
  const body = await readBody(request);
  return signInApp(cleanEmail(body.email), cleanPassword(body.password));
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return {};
  }
}
