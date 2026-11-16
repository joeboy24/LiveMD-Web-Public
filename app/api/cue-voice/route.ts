import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function POST(request: Request) {
  const text = (await request.text()).replace(/\s+/g, " ").trim().slice(0, 80);
  if (!text) return new Response(null, { status: 400 });
  try {
    const bytes = await renderVoice(text);
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}

function renderVoice(text: string) {
  return new Promise<Buffer>((resolve, reject) => {
    mkdtemp(join(tmpdir(), "cue-"))
      .then((dir) => {
        const file = join(dir, "cue.wav");
        const child = spawn("say", ["-o", file, "--file-format=WAVE", "--data-format=LEI16@22050", text], { stdio: "ignore" });
        const finish = (error?: Error) => {
          void rm(dir, { recursive: true, force: true });
          if (error) reject(error);
        };
        child.on("error", () => finish(new Error("voice")));
        child.on("close", (code) => {
          if (code !== 0) {
            finish(new Error("voice"));
            return;
          }
          readFile(file).then(
            (bytes) => {
              void rm(dir, { recursive: true, force: true });
              resolve(bytes);
            },
            () => finish(new Error("voice")),
          );
        });
      })
      .catch(() => reject(new Error("voice")));
  });
}
