import { NextResponse } from "next/server";
import { consumeSignInLink, openSession, sessionCookie } from "../../auth/queries";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const accountId = await consumeSignInLink(token);
  if (!accountId) return NextResponse.redirect(new URL("/sign-in?error=expired", request.url));
  const session = await openSession(accountId);
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(sessionCookie.name, session, sessionCookie.options);
  return response;
}
