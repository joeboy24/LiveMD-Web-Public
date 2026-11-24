import { cookies } from "next/headers";
import { cleanEmail, cleanName, signInGoogle } from "../../account";
import { googleCallbackURL, googlePage, googleStateCookie } from "../../google";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return googlePage("Google sign-in is not connected yet.");

  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get(googleStateCookie)?.value ?? "";
  jar.delete(googleStateCookie);
  if (!code || !state || state !== expected) return googlePage("Google sign-in did not finish. Try again.");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleCallbackURL(request),
      grant_type: "authorization_code",
    }),
  });
  const tokenBody = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) return googlePage("Google did not confirm the account.");

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tokenBody.access_token}` },
  });
  const profile = (await profileResponse.json()) as { email?: string; name?: string; verified_email?: boolean };
  const email = cleanEmail(profile.email);
  if (!profileResponse.ok || !email || profile.verified_email === false) return googlePage("Google did not share an email.");

  const session = await signInGoogle(email, cleanName(profile.name));
  if (!session) return googlePage("This account is closed.");
  const done = new URL("livemd://auth");
  done.searchParams.set("token", session.token);
  done.searchParams.set("email", session.email);
  done.searchParams.set("name", session.name);
  return new Response(null, { status: 302, headers: { location: done.toString(), "cache-control": "no-store" } });
}
