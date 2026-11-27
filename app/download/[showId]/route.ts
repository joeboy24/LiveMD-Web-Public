import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connection } from "next/server";
import { getSql } from "../../db";
import { cueVoicePack } from "../../shows/cue-speech";
import { offlinePackage, snapshotSongs } from "../../shows/publication";
import { saveAudio } from "../../shows/storage";
import { writeStoreZip } from "../../shows/zip-store";

export async function GET(_request: Request, context: { params: Promise<{ showId: string }> }) {
  await connection();
  const { showId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(showId)) return new Response(null, { status: 404 });

  const sql = getSql();
  const rows = await sql`
    select title, performed_on::text as "performedOn", published_at::text as "publishedAt", published_snapshot as snapshot
    from shows
    where id = ${showId}
  `;
  const row = rows[0];
  const songs = row ? snapshotSongs(row.snapshot) : null;
  if (!row?.publishedAt || !songs) return new Response(null, { status: 404 });
  const pack = offlinePackage(songs);
  if (!pack) return new Response(null, { status: 500 });
  if (pack.songs.length === 0) return new Response(null, { status: 404 });

  const folder = await mkdtemp(join(tmpdir(), "livemd-"));
  try {
    const voices = await cueVoicePack(pack.songs.flatMap((song) => song.cues.map((cue) => cue.text)));
    const byText = new Map(voices.map((voice) => [voice.text, voice.file]));
    const songs = pack.songs.map((song) => ({
      ...song,
      cueVoices: song.cues.flatMap((cue) => {
        const file = byText.get(cue.text.trim().slice(0, 80));
        return file ? [{ text: cue.text.trim().slice(0, 80), file }] : [];
      }),
    }));
    const manifest = join(folder, "show.json");
    await writeFile(
      manifest,
      JSON.stringify({
        id: showId,
        title: String(row.title),
        performedOn: String(row.performedOn).slice(0, 10),
        songs,
      }),
    );
    const entries = [{ name: "show.json", path: manifest }];
    for (const voice of voices) {
      const path = join(folder, voice.file);
      await writeFile(path, voice.body);
      entries.push({ name: `audio/${voice.file}`, path });
    }
    for (const file of pack.files) {
      const path = join(folder, file.name.replaceAll("/", "-"));
      const saved = await saveAudio(showId, file.key, path);
      if (!saved) return new Response(null, { status: 500 });
      entries.push({ name: file.name, path });
    }
    const zipPath = join(folder, "show.zip");
    await writeStoreZip(zipPath, entries);
    const bytes = await readFile(zipPath);
    const size = (await stat(zipPath)).size;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName(String(row.title))}.zip"`,
        "Content-Length": String(size),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(null, { status: 500 });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

function fileName(title: string) {
  const clean = title.replace(/[^\w.-]+/g, " ").trim();
  return clean || "show";
}
