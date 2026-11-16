import { connectBus } from "./outputs";

const clips = new Map<string, Promise<ArrayBuffer | null>>();
const active = new Set<AudioBufferSourceNode>();

export function prepareCueVoices(texts: string[]) {
  return Promise.all(texts.map((text) => clip(text.trim()))).then(() => undefined);
}

export async function speakCue(context: AudioContext, text: string, gain: number, output: number) {
  const clean = text.trim();
  if (!clean || gain <= 0.001) return;
  const bytes = await clip(clean);
  if (!bytes) return;
  const buffer = await context.decodeAudioData(bytes.slice(0));
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

function clip(text: string) {
  if (!text) return Promise.resolve(null);
  let pending = clips.get(text);
  if (!pending) {
    pending = fetch("/api/cue-voice", {
      method: "POST",
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: text,
    })
      .then(async (response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null);
    clips.set(text, pending);
  }
  return pending;
}
