import { cookies } from "next/headers";
import { newToken } from "../../../../auth/queries";
import { googleCallbackURL, googlePage, googleStateCookie } from "../../google";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return googlePage("Google sign-in is not connected yet.");
  const state = newToken();
  const jar = await cookies();
  jar.set(googleStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/app/google",
    maxAge: 10 * 60,
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleCallbackURL(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return Response.redirect(url);
}
