import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveAudio } from "./storage";
import { writeStoreZip } from "./zip-store";

type OfflineSong = {
  title: string;
  tempo: number;
  beatsPerBar: number;
  stemFile: string;
  guideFile?: string;
  trackFiles: string[];
};

type OfflineFile = {
  name: string;
  key: string;
};

export async function showZip(
  show: { id: string; title: string; performedOn: string },
  pack: { songs: OfflineSong[]; files: OfflineFile[] },
) {
  const folder = await mkdtemp(join(tmpdir(), "livemd-"));
  try {
    const manifest = join(folder, "show.json");
    await writeFile(
      manifest,
      JSON.stringify({
        id: show.id,
        title: show.title,
        performedOn: show.performedOn.slice(0, 10),
        songs: pack.songs,
      }),
    );
    const entries = [{ name: "show.json", path: manifest }];
    for (const file of pack.files) {
      const path = join(folder, file.name.replaceAll("/", "-"));
      const saved = await saveAudio(show.id, file.key, path);
      if (!saved) return null;
      entries.push({ name: file.name, path });
    }
    const zipPath = join(folder, "show.zip");
    await writeStoreZip(zipPath, entries);
    return await readFile(zipPath);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
