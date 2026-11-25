import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName } from "./app/auth/cookie";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/sign-in" || path.startsWith("/sign-in/") || path.startsWith("/api/player") || path.startsWith("/api/app/") || path === "/api/stripe/webhook" || path.startsWith("/fonts") || path.startsWith("/.well-known/")) {
    return continueWithPath(request);
  }
  const session = request.cookies.get(sessionCookieName)?.value;
  if (session) return continueWithPath(request);
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  return NextResponse.redirect(url);
}

function continueWithPath(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-livemd-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
