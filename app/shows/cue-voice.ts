import { connectBus } from "./outputs";

const clips = new Map<string, Promise<ArrayBuffer | null>>();
const decoded = new Map<string, Promise<AudioBuffer | null>>();
const active = new Set<AudioBufferSourceNode>();

export function prepareCueVoices(context: AudioContext, texts: string[]) {
  return Promise.all(texts.map((text) => cueBuffer(context, text))).then(() => undefined);
}

export async function speakCue(context: AudioContext, text: string, gain: number, output: number) {
  const clean = text.trim();
  if (!clean || gain <= 0.001) return;
  const buffer = await cueBuffer(context, clean);
  if (!buffer) return;
  const source = context.createBufferSource();
  const level = context.createGain();
  source.buffer = buffer;
  level.gain.value = gain;
  source.connect(level);
  connectBus(level, context, output);
  active.add(source);
  source.onended = () => {
    active.delete(source);
    try {
      level.disconnect();
    } catch {
      // The cue already stopped.
    }
  };
  source.start();
}

export function stopCueVoices() {
  for (const source of active) {
    source.onended = null;
    try {
      source.stop();
    } catch {
      // The cue already finished.
    }
    try {
      source.disconnect();
    } catch {
      // The cue was not connected.
    }
  }
  active.clear();
}

function cueBuffer(context: AudioContext, text: string) {
  const clean = text.trim();
  if (!clean) return Promise.resolve(null);
  let pending = decoded.get(clean);
  if (!pending) {
    pending = clip(clean).then(async (bytes) => {
      if (!bytes) {
        decoded.delete(clean);
        return null;
      }
      try {
        return trimLead(await context.decodeAudioData(bytes.slice(0)));
      } catch {
        decoded.delete(clean);
        return null;
      }
    });
    decoded.set(clean, pending);
  }
  return pending;
}

function trimLead(buffer: AudioBuffer) {
  const rate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let start = 0;
  for (; start < length; start += 1) {
    let heard = false;
    for (let channel = 0; channel < channels; channel += 1) {
      if (Math.abs(data[channel][start]) >= 0.02) {
        heard = true;
        break;
      }
    }
    if (heard) break;
  }
  const offset = Math.max(0, start - Math.floor(rate * 0.012));
  if (offset < rate * 0.03 || length - offset < rate * 0.05) return buffer;
  const trimmed = new AudioBuffer({ length: length - offset, numberOfChannels: channels, sampleRate: rate });
  for (let channel = 0; channel < channels; channel += 1) trimmed.copyToChannel(data[channel].subarray(offset), channel);
  return trimmed;
}

function clip(text: string) {
  if (!text) return Promise.resolve(null);
  const pending = clips.get(text);
  if (pending) return pending;
  const next = fetch("/api/cue-voice", {
    method: "POST",
    headers: { "content-type": "text/plain; charset=utf-8" },
    body: text,
  })
    .then(async (response) => {
      if (!response.ok) {
        clips.delete(text);
        return null;
      }
      return response.arrayBuffer();
    })
    .catch(() => {
      clips.delete(text);
      return null;
    });
  clips.set(text, next);
  return next;
}
