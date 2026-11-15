import { readFile } from "node:fs/promises";

const roundedFont = "/System/Library/Fonts/SFNSRounded.ttf";

export async function GET() {
  try {
    const body = await readFile(roundedFont);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "font/ttf",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
