import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSql } from "../db";
import { readOrganization } from "../(main)/organization/queries";
import { parseCues } from "./structure";
import { readCueAudio, writeCueAudio } from "./storage";
import type { SongCue } from "./types";

const cueWordCap = 100;
const voiceName = "en-US-Chirp3-HD-Aoede";

type Spoken = { body: Buffer; contentType: string };
type SpeechResult = Spoken | "unconfigured" | "failed";

export function cueVoiceKey(text: string) {
  return `cues/${createHash("sha256").update(text).digest("hex")}`;
}

export async function cueWordsExceeded(songId: string, nextCues: SongCue[]) {
  const organization = await readOrganization();
  if (!organization) return false;
  const rows = await organizationCueRows(organization.id);
  const showId = rows.find((row) => row.id === songId)?.showId;
  if (!showId) return false;
  const before = new Set<string>();
  const after = new Set<string>();
  for (const row of rows) {
    if (row.showId !== showId) continue;
    for (const cue of parseCues(row.cues)) {
      before.add(cue.text);
      if (row.id !== songId) after.add(cue.text);
    }
  }
  for (const cue of nextCues) after.add(cue.text);
  const nextWords = wordCount(after);
  return nextWords > cueWordCap && nextWords > wordCount(before);
}

export async function organizationHasCue(text: string) {
  const organization = await readOrganization();
  if (!organization || !text) return false;
  const texts = await organizationCueTexts(organization.id);
  return texts.has(text);
}

export async function storeCueVoices(texts: string[]) {
  const pending: string[] = [];
  for (const text of new Set(texts.map((item) => item.trim()).filter(Boolean))) {
    if (await readCueAudio(cueVoiceKey(text))) continue;
    pending.push(text);
  }
  if (pending.length === 0) return null;
  const spoken = await Promise.all(pending.map((text) => synthesize(text)));
  if (spoken.every((item) => item === "unconfigured")) return null;
  if (spoken.some((item) => item === "failed" || item === "unconfigured")) return "The cue voice didn't render.";
  for (let index = 0; index < pending.length; index += 1) {
    const item = spoken[index];
    if (item === "failed" || item === "unconfigured") continue;
    const wrote = await writeCueAudio(cueVoiceKey(pending[index]), item.body, item.contentType);
    if (!wrote) return "Audio storage isn't set up yet.";
  }
  return null;
}

export async function openCueVoice(text: string): Promise<Spoken | null> {
  const clean = text.trim().slice(0, 80);
  if (!clean) return null;
  const key = cueVoiceKey(clean);
  const existing = await readCueAudio(key);
  if (existing) return existing;
  const spoken = await synthesize(clean);
  if (spoken === "failed" || spoken === "unconfigured") return null;
  const wrote = await writeCueAudio(key, spoken.body, spoken.contentType);
  return wrote ? spoken : null;
}

async function organizationCueTexts(organizationId: string) {
  const texts = new Set<string>();
  for (const row of await organizationCueRows(organizationId)) {
    for (const cue of parseCues(row.cues)) texts.add(cue.text);
  }
  return texts;
}

async function organizationCueRows(organizationId: string) {
  const sql = getSql();
  const rows = await sql`
    select songs.id, songs.show_id as "showId", songs.cues
    from songs
    join shows on shows.id = songs.show_id
    where shows.organization_id = ${organizationId} or shows.organization_id is null
  `;
  return rows.map((row) => ({ id: String(row.id), showId: String(row.showId), cues: row.cues }));
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

function wordCount(texts: Set<string>) {
  let total = 0;
  for (const text of texts) total += text.split(/\s+/).filter(Boolean).length;
  return total;
}

async function synthesize(text: string): Promise<SpeechResult> {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (key) return googleVoice(text, key, voiceName);
  return macVoice(text);
}

async function googleVoice(text: string, key: string, name: string): Promise<SpeechResult> {
  try {
    const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name },
        audioConfig: { audioEncoding: "LINEAR16" },
      }),
    });
    if (!response.ok) return "failed";
    const payload = (await response.json()) as { audioContent?: string };
    if (!payload.audioContent) return "failed";
    return { body: withoutLead(Buffer.from(payload.audioContent, "base64")), contentType: "audio/wav" };
  } catch {
    return "failed";
  }
}

function macVoice(text: string): Promise<SpeechResult> {
  return new Promise((resolve) => {
    mkdtemp(join(tmpdir(), "cue-"))
      .then((dir) => {
        const file = join(dir, "cue.wav");
        const child = spawn("say", ["-o", file, "--file-format=WAVE", "--data-format=LEI16@22050", text], { stdio: "ignore" });
        const finish = (result: SpeechResult) => {
          void rm(dir, { recursive: true, force: true });
          resolve(result);
        };
        child.on("error", () => finish("unconfigured"));
        child.on("close", (code) => {
          if (code !== 0) {
            finish("failed");
            return;
          }
          readFile(file).then(
            (body) => {
              void rm(dir, { recursive: true, force: true });
              resolve({ body: withoutLead(body), contentType: "audio/wav" });
            },
            () => finish("failed"),
          );
        });
      })
      .catch(() => resolve("failed"));
  });
}
