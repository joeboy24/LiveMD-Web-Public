import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cueVoicePack } from "./cue-speech";
import { saveAudio } from "./storage";
import { writeStoreZip } from "./zip-store";

type OfflineSong = {
  title: string;
  tempo: number;
  beatsPerBar: number;
  stemFile: string;
  guideFile?: string;
  trackFiles: string[];
  cues?: { text: string }[];
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
    const voices = await cueVoicePack(pack.songs.flatMap((song) => (song.cues ?? []).map((cue) => cue.text)));
    const byText = new Map(voices.map((voice) => [voice.text, voice.file]));
    const songs = pack.songs.map((song) => ({
      ...song,
      cueVoices: (song.cues ?? []).flatMap((cue) => {
        const file = byText.get(cue.text.trim().slice(0, 80));
        return file ? [{ text: cue.text.trim().slice(0, 80), file }] : [];
      }),
    }));
    const manifest = join(folder, "show.json");
    await writeFile(
      manifest,
      JSON.stringify({
        id: show.id,
        title: show.title,
        performedOn: show.performedOn.slice(0, 10),
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
