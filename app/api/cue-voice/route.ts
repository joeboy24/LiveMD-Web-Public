import { openCueVoice, organizationHasCue } from "../../shows/cue-speech";

export async function POST(request: Request) {
  const text = (await request.text()).trim().slice(0, 80);
  if (!text) return new Response(null, { status: 400 });
  if (!(await organizationHasCue(text))) return new Response(null, { status: 404 });
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
