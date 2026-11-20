const voices = ["en-US-Chirp3-HD-Aoede", "en-US-Chirp3-HD-Kore", "en-US-Chirp3-HD-Leda", "en-US-Chirp3-HD-Zephyr"];
const lines = ["Intro", "Lead vocal in"];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { voice?: unknown; text?: unknown } | null;
  const voice = typeof body?.voice === "string" ? body.voice : "";
  const text = typeof body?.text === "string" ? body.text : "";
  if (!voices.includes(voice) || !lines.includes(text)) return new Response(null, { status: 400 });
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) return new Response(null, { status: 503 });
  try {
    const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name: voice },
        audioConfig: { audioEncoding: "LINEAR16" },
      }),
    });
    if (!response.ok) return new Response(null, { status: 503 });
    const payload = (await response.json()) as { audioContent?: string };
    if (!payload.audioContent) return new Response(null, { status: 503 });
    const audio = withoutLead(Buffer.from(payload.audioContent, "base64"));
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}

function withoutLead(body: Buffer) {
  if (body.toString("ascii", 0, 4) !== "RIFF" || body.toString("ascii", 8, 12) !== "WAVE") return body;
  let format = 1;
  let channels = 1;
  let rate = 22050;
  let bits = 16;
  let dataAt = -1;
  let dataSize = 0;
  let cursor = 12;
  while (cursor + 8 <= body.length) {
    const id = body.toString("ascii", cursor, cursor + 4);
    const size = body.readUInt32LE(cursor + 4);
    const start = cursor + 8;
    if (id === "fmt " && start + 16 <= body.length) {
      format = body.readUInt16LE(start);
      channels = body.readUInt16LE(start + 2);
      rate = body.readUInt32LE(start + 4);
      bits = body.readUInt16LE(start + 14);
    }
    if (id === "data") {
      dataAt = start;
      dataSize = Math.min(size, body.length - start);
      break;
    }
    cursor = start + size + (size % 2);
  }
  const frame = channels * 2;
  if (format !== 1 || bits !== 16 || channels < 1 || dataAt < 0 || frame <= 0) return body;
  const frames = Math.floor(dataSize / frame);
  let first = frames;
  for (let index = 0; index < frames; index += 1) {
    const offset = dataAt + index * frame;
    let heard = false;
    for (let channel = 0; channel < channels; channel += 1) {
      if (Math.abs(body.readInt16LE(offset + channel * 2)) >= 656) {
        heard = true;
        break;
      }
    }
    if (heard) {
      first = index;
      break;
    }
  }
  const skip = Math.max(0, first - Math.floor(rate * 0.012));
  if (skip < rate * 0.03 || frames - skip < rate * 0.05) return body;
  const pcm = body.subarray(dataAt + skip * frame, dataAt + frames * frame);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * frame, 28);
  header.writeUInt16LE(frame, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
