export function tempoAgrees(detected: number, entered: number) {
  const family = [detected, detected / 2, detected * 2].filter((value) => value >= 40 && value <= 240);
  const tolerance = Math.max(3, entered * 0.025);
  return family.some((value) => Math.abs(value - entered) <= tolerance);
}

export function detectTempo(samples: Float32Array, sampleRate: number) {
  const hop = 256;
  if (samples.length <= hop * 8 || sampleRate <= 0) return null;
  const envelope: number[] = [];
  let previous = 0;
  for (let position = 0; position + hop <= samples.length; position += hop) {
    let energy = 0;
    for (let index = 0; index < hop; index += 1) {
      const value = samples[position + index];
      energy += value * value;
    }
    envelope.push(Math.max(0, energy - previous));
    previous = energy;
  }
  let peak = 0;
  for (const value of envelope) if (value > peak) peak = value;
  if (peak <= 0) return null;
  for (let index = 0; index < envelope.length; index += 1) envelope[index] /= peak;

  const frameDuration = hop / sampleRate;
  const minLag = Math.max(1, Math.round(60 / (240 * frameDuration)));
  const maxLag = Math.min(Math.floor(envelope.length / 2), Math.round(60 / (40 * frameDuration)));
  if (maxLag <= minLag) return null;

  let bestLag = minLag;
  let best = 0;
  let total = 0;
  let counted = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    const length = envelope.length - lag;
    for (let index = 0; index < length; index += 1) sum += envelope[index] * envelope[index + lag];
    const score = sum / length;
    total += score;
    counted += 1;
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  const average = total / Math.max(counted, 1);
  if (best <= average * 1.35) return null;
  const bpm = 60 / (bestLag * frameDuration);
  if (bpm < 40 || bpm > 240) return null;
  return bpm;
}

function windowFrom(buffer: AudioBuffer) {
  const sampleRate = buffer.sampleRate;
  if (sampleRate <= 0 || buffer.length === 0) return null;
  const start = Math.min(Math.floor(sampleRate * 5), Math.floor(buffer.length / 5));
  const count = Math.min(Math.floor(sampleRate * 25), Math.max(0, buffer.length - start));
  if (count <= sampleRate * 4) return null;
  const channels = buffer.numberOfChannels;
  const mono = new Float32Array(count);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < count; index += 1) mono[index] += data[start + index];
  }
  const scale = 1 / channels;
  for (let index = 0; index < count; index += 1) mono[index] *= scale;
  const step = Math.max(1, Math.round(sampleRate / 11025));
  const down = new Float32Array(Math.ceil(count / step));
  let index = 0;
  let written = 0;
  while (index < count) {
    down[written] = mono[index];
    written += 1;
    index += step;
  }
  return { samples: down.subarray(0, written), sampleRate: sampleRate / step };
}

export async function suggestTempo(file: File, entered: number) {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const audio = windowFrom(buffer);
    if (!audio) return null;
    const bpm = detectTempo(audio.samples, audio.sampleRate);
    if (bpm == null || tempoAgrees(bpm, entered)) return null;
    const rounded = Math.min(240, Math.max(40, Math.round(bpm)));
    if (rounded === Math.round(entered)) return null;
    return rounded;
  } catch {
    return null;
  } finally {
    await context.close();
  }
}
