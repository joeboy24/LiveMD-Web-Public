import { cache } from "react";
import { readSystemAdmin } from "../admin/access";
import { readOrganization } from "../(main)/organization/queries";
import { readSessionAccount } from "./queries";

export type AudioLayer = "stem" | "guide" | "track";

export type SeatAccess = {
  role: string | null;
  prepare: boolean;
  chart: boolean;
  transport: boolean;
  stage: boolean;
  organize: boolean;
  publish: boolean;
  web: boolean;
  systemOnly: boolean;
  layers: readonly AudioLayer[];
};

const everyLayer = ["stem", "guide", "track"] as const;

export function accessFor(role: string | null, signedIn = false): SeatAccess {
  if (role === "Musician") {
    return { role, prepare: true, chart: true, transport: true, stage: true, organize: true, publish: false, web: true, systemOnly: false, layers: everyLayer };
  }
  if (role === "Playback operator") {
    return { role, prepare: false, chart: false, transport: false, stage: false, organize: false, publish: false, web: false, systemOnly: false, layers: ["stem", "guide"] };
  }
  if (role === "Owner" || role === "Music director") {
    return { role, prepare: true, chart: true, transport: true, stage: true, organize: true, publish: true, web: true, systemOnly: false, layers: everyLayer };
  }
  if (signedIn) {
    return { role: null, prepare: false, chart: false, transport: false, stage: false, organize: true, publish: false, web: true, systemOnly: false, layers: [] };
  }
  return { role: null, prepare: true, chart: true, transport: true, stage: true, organize: true, publish: true, web: true, systemOnly: false, layers: everyLayer };
}

export function keepsAudio(
  name: string,
  songs: { stemFile: string; guideFile?: string; trackFiles: string[] }[],
  layers: readonly AudioLayer[],
) {
  if (layers.length === everyLayer.length) return true;
  for (const song of songs) {
    if (name.endsWith(song.stemFile)) return layers.includes("stem");
    if (song.guideFile && name.endsWith(song.guideFile)) return layers.includes("guide");
    if (song.trackFiles.some((file) => name.endsWith(file))) return layers.includes("track");
  }
  return false;
}

export const readAccess = cache(async (): Promise<SeatAccess> => {
  const account = await readSessionAccount();
  if (!account) return accessFor(null, false);
  const organization = await readOrganization();
  const seat = organization?.seats.find((item) => item.accountId === account.id) ?? null;
  const access = accessFor(seat?.role ?? null, true);
  if (seat || !(await readSystemAdmin())) return access;
  return { ...access, prepare: false, chart: false, transport: false, stage: false, organize: false, publish: false, web: false, systemOnly: true, layers: [] };
});

export async function denied(kind: "prepare" | "stage" | "organize" | "publish") {
  const access = await readAccess();
  const allowed =
    kind === "prepare" ? access.prepare : kind === "stage" ? access.prepare || access.stage : kind === "publish" ? access.publish : access.organize;
  return allowed ? null : "This seat can't change that.";
}
