import type { MixChannel, SongMix } from "./types";

export function defaultMix(): SongMix {
  return {
    stems: fresh(),
    click: fresh(),
    cues: fresh(),
    layers: {},
  };
}

export function storedMix(value: unknown): SongMix {
  const record = typeof value === "string" ? parseJson(value) : value;
  if (!record || typeof record !== "object") return defaultMix();
  const mix = record as Partial<SongMix>;
  const layers: Record<string, MixChannel> = {};
  if (mix.layers && typeof mix.layers === "object") {
    for (const [id, channel] of Object.entries(mix.layers).slice(0, 16)) {
      if (id.length > 0 && id.length <= 200) layers[id] = cleanChannel(channel);
    }
  }
  return {
    stems: cleanChannel(mix.stems),
    click: cleanChannel(mix.click),
    cues: cleanChannel(mix.cues),
    layers,
  };
}

export function busGain(channel: MixChannel, mix: SongMix) {
  if (channel.muted) return 0;
  if ((mix.stems.solo || mix.click.solo || mix.cues.solo) && !channel.solo) return 0;
  return Math.min(Math.max(channel.level, 0), 1);
}

export function layerGain(id: string, mix: SongMix, ids: string[]) {
  const bus = busGain(mix.stems, mix);
  if (bus <= 0.001) return 0;
  const channel = mix.layers[id] ?? fresh();
  if (channel.muted) return 0;
  if (ids.some((item) => mix.layers[item]?.solo) && !channel.solo) return 0;
  return bus * Math.min(Math.max(channel.level, 0), 1);
}

function fresh(): MixChannel {
  return { level: 1, muted: false, solo: false };
}

function cleanChannel(value: unknown): MixChannel {
  if (!value || typeof value !== "object") return fresh();
  const channel = value as Partial<MixChannel>;
  const level = typeof channel.level === "number" && Number.isFinite(channel.level) ? Math.min(Math.max(channel.level, 0), 1) : 1;
  return { level, muted: channel.muted === true, solo: channel.solo === true };
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
