import { connection } from "next/server";
import { openCueVoice } from "../../../shows/cue-speech";
import { appError, readAppAccount } from "../account";
import { seatInPlace, showIdPattern } from "../shows/access";

export async function POST(request: Request) {
  await connection();
  const account = await readAppAccount(request);
  if (!account) return appError("Sign in required.", 401);
  const placeId = new URL(request.url).searchParams.get("placeId") ?? "";
  if (!showIdPattern.test(placeId)) return appError("Choose an organization.", 400);
  const seat = await seatInPlace(account.id, placeId);
  if (!seat) return appError("This seat can't use that organization.", 403);
  const text = (await request.text()).trim().slice(0, 80);
  if (!text) return new Response(null, { status: 400 });
  try {
    const voice = await openCueVoice(text);
    if (!voice) return new Response(null, { status: 503 });
    return new Response(new Uint8Array(voice.body), {
      headers: { "Content-Type": voice.contentType, "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
