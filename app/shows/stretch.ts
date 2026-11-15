const windowSize = 2048;
const synthHop = 1024;
const seek = 512;
const step = 8;
const hann = new Float32Array(windowSize);
for (let i = 0; i < windowSize; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / windowSize));

const stretched = new WeakMap<AudioBuffer, Map<string, AudioBuffer>>();
const pending = new WeakMap<AudioBuffer, Map<string, Promise<AudioBuffer>>>();

export function playable(buffer: AudioBuffer, rate: number, fileOffset: number) {
  const played = Math.abs(rate - 1) < 0.001 ? buffer : stretched.get(buffer)?.get(rateKey(rate)) ?? buffer;
  const span = played.duration / buffer.duration;
  const offset = Math.min(Math.max(fileOffset * span, 0), Math.max(played.duration - 0.02, 0));
  return { buffer: played, offset };
}

export function prepareStretch(buffer: AudioBuffer, rate: number) {
  if (Math.abs(rate - 1) < 0.001) return Promise.resolve(buffer);
  const key = rateKey(rate);
  const saved = stretched.get(buffer)?.get(key);
  if (saved) return Promise.resolve(saved);
  let jobs = pending.get(buffer);
  if (!jobs) {
    jobs = new Map();
    pending.set(buffer, jobs);
  }
  const existing = jobs.get(key);
  if (existing) return existing;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const job = stretchChannels(channels, rate, 120).then((output) => {
    const next = new AudioBuffer({
      length: output[0].length,
      numberOfChannels: output.length,
      sampleRate: buffer.sampleRate,
    });
    output.forEach((channel, index) => {
      const target = next.getChannelData(index);
      target.set(target.length === channel.length ? channel : channel.subarray(0, target.length));
    });
    let savedRates = stretched.get(buffer);
    if (!savedRates) {
      savedRates = new Map();
      stretched.set(buffer, savedRates);
    }
    savedRates.set(key, next);
    jobs?.delete(key);
    return next;
  });
  jobs.set(key, job);
  return job;
}

export function stretchChannels(channels: Float32Array[], rate: number, yieldEvery = 0) {
  const inputLength = channels[0].length;
  const outputLength = Math.max(1, Math.round(inputLength / rate));
  const guide = channels.length === 1 ? channels[0] : mixdown(channels);
  const outputs = channels.map(() => new Float32Array(outputLength));
  const analysisHop = Math.max(1, Math.round(synthHop * rate));
  const state = { natural: 0, outputPos: 0, previous: 0, first: true };
  if (yieldEvery <= 0) {
    while (placeFrame(channels, outputs, guide, state, analysisHop, outputLength)) {
      // The whole buffer is stretched before playback starts.
    }
    return Promise.resolve(outputs);
  }
  return new Promise<Float32Array[]>((resolve) => {
    let frames = 0;
    const stepFrames = () => {
      const slice = performance.now() + 8;
      while (performance.now() < slice && placeFrame(channels, outputs, guide, state, analysisHop, outputLength)) frames += 1;
      if (state.outputPos >= outputLength || state.natural >= guide.length) {
        resolve(outputs);
        return;
      }
      if (frames >= yieldEvery) frames = 0;
      setTimeout(stepFrames, 0);
    };
    stepFrames();
  });
}

function placeFrame(
  channels: Float32Array[],
  outputs: Float32Array[],
  guide: Float32Array,
  state: { natural: number; outputPos: number; previous: number; first: boolean },
  analysisHop: number,
  outputLength: number,
) {
  if (state.outputPos >= outputLength || state.natural >= guide.length) return false;
  const start = state.first ? 0 : match(guide, state.previous, state.natural);
  for (let channel = 0; channel < channels.length; channel++) {
    const input = channels[channel];
    const output = outputs[channel];
    const count = Math.min(windowSize, outputLength - state.outputPos, input.length - start);
    for (let i = 0; i < count; i++) output[state.outputPos + i] += input[start + i] * hann[i];
  }
  state.previous = start;
  state.natural = start + analysisHop;
  state.outputPos += synthHop;
  state.first = false;
  return true;
}

function match(guide: Float32Array, previous: number, natural: number) {
  const overlap = synthHop;
  const reference = previous + synthHop;
  const from = Math.max(0, natural - seek);
  const to = Math.min(guide.length - windowSize, natural + seek);
  let best = Math.max(0, Math.min(natural, Math.max(guide.length - windowSize, 0)));
  let bestScore = -Infinity;
  if (reference < 0 || to < from) return best;
  for (let candidate = from; candidate <= to; candidate += step) {
    let score = 0;
    const limit = Math.min(overlap, guide.length - candidate, guide.length - reference);
    for (let i = 0; i < limit; i += 2) score += guide[reference + i] * guide[candidate + i];
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function mixdown(channels: Float32Array[]) {
  const mixed = new Float32Array(channels[0].length);
  const scale = 1 / channels.length;
  for (const channel of channels) {
    for (let i = 0; i < mixed.length; i++) mixed[i] += channel[i] * scale;
  }
  return mixed;
}

function rateKey(rate: number) {
  return rate.toFixed(4);
}
