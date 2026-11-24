export const googleStateCookie = "livemd_google_state";

export function googleCallbackURL(request: Request) {
  const origin = new URL(request.url).origin;
  return `${origin}/api/app/google/callback`;
}

export function googlePage(message: string) {
  const body = `<!doctype html><html><body style="font-family:sans-serif;padding:32px"><p>${message}</p></body></html>`;
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
