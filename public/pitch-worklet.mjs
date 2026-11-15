function transform(real, imag, inverse) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const swapReal = real[i];
      real[i] = real[j];
      real[j] = swapReal;
      const swapImag = imag[i];
      imag[i] = imag[j];
      imag[j] = swapImag;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const angle = ((Math.PI * 2) / size) * (inverse ? 1 : -1);
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let twiddleReal = 1;
      let twiddleImag = 0;
      for (let offset = 0; offset < half; offset++) {
        const even = start + offset;
        const odd = even + half;
        const mixedReal = twiddleReal * real[odd] - twiddleImag * imag[odd];
        const mixedImag = twiddleReal * imag[odd] + twiddleImag * real[odd];
        real[odd] = real[even] - mixedReal;
        imag[odd] = imag[even] - mixedImag;
        real[even] += mixedReal;
        imag[even] += mixedImag;
        const nextReal = twiddleReal * stepReal - twiddleImag * stepImag;
        twiddleImag = twiddleReal * stepImag + twiddleImag * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
  if (!inverse) return;
  for (let i = 0; i < n; i++) {
    real[i] /= n;
    imag[i] /= n;
  }
}

function wrap(phase) {
  return phase - Math.PI * 2 * Math.round(phase / (Math.PI * 2));
}

export class PitchEngine {
  constructor(sampleRate, channels, fftSize = 4096, osamp = 4) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.osamp = osamp;
    this.hop = fftSize / this.osamp;
    this.latency = fftSize - this.hop;
    this.freqPerBin = sampleRate / fftSize;
    this.expected = (Math.PI * 2 * this.hop) / fftSize;
    this.hann = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) this.hann[i] = 0.5 - 0.5 * Math.cos((Math.PI * 2 * i) / fftSize);
    this.ratio = 1;
    this.steps = 0;
    this.targetSteps = 0;
    this.fftReal = new Float32Array(fftSize);
    this.synFrom = new Float32Array(fftSize / 2 + 1);
    this.fftImag = new Float32Array(fftSize);
    const bins = fftSize / 2 + 1;
    this.channels = Array.from({ length: channels }, () => ({
      input: new Float32Array(fftSize),
      output: new Float32Array(fftSize),
      lastPhase: new Float32Array(bins),
      sumPhase: new Float32Array(bins),
      anaMag: new Float32Array(bins),
      anaFreq: new Float32Array(bins),
      synMag: new Float32Array(bins),
      synFreq: new Float32Array(bins),
      rover: this.latency,
    }));
  }

  setRatio(ratio) {
    this.ratio = ratio;
  }

  setSteps(steps) {
    this.steps = steps;
    this.targetSteps = steps;
    this.ratio = 2 ** (steps / 12);
  }

  glideSteps(steps) {
    this.targetSteps = steps;
  }

  process(channels) {
    const length = channels[0].length;
    const output = channels.map(() => new Float32Array(length));
    for (let frame = 0; frame < length; frame++) {
      for (let channel = 0; channel < channels.length; channel++) {
        output[channel][frame] = this.sample(channel, channels[channel][frame]);
      }
    }
    return output;
  }

  sample(index, value) {
    if (index === 0 && this.steps !== this.targetSteps) {
      const step = 1 / (this.sampleRate * 0.025);
      this.steps = this.steps < this.targetSteps ? Math.min(this.targetSteps, this.steps + step) : Math.max(this.targetSteps, this.steps - step);
      this.ratio = 2 ** (this.steps / 12);
    }
    const state = this.channels[index];
    state.input[state.rover] = value;
    const heard = state.output[state.rover - this.latency];
    state.rover += 1;
    if (state.rover < this.fftSize) return heard;
    state.rover = this.latency;
    this.shiftFrame(state);
    state.input.copyWithin(0, this.hop);
    state.output.copyWithin(0, this.hop);
    state.output.fill(0, this.fftSize - this.hop);
    return heard;
  }

  shiftFrame(state) {
    const bins = this.fftSize / 2;
    for (let i = 0; i < this.fftSize; i++) {
      this.fftReal[i] = state.input[i] * this.hann[i];
      this.fftImag[i] = 0;
    }
    transform(this.fftReal, this.fftImag, false);
    for (let bin = 0; bin <= bins; bin++) {
      const magnitude = Math.hypot(this.fftReal[bin], this.fftImag[bin]);
      const phase = Math.atan2(this.fftImag[bin], this.fftReal[bin]);
      const delta = wrap(phase - state.lastPhase[bin] - bin * this.expected);
      state.lastPhase[bin] = phase;
      state.anaMag[bin] = magnitude;
      state.anaFreq[bin] = (bin + (delta * this.osamp) / (Math.PI * 2)) * this.freqPerBin;
    }
    state.synMag.fill(0);
    state.synFreq.fill(0);
    const ratio = this.ratio;
    let peak = 0;
    let before = 0;
    for (let bin = 0; bin <= bins; bin++) {
      peak = Math.max(peak, state.anaMag[bin]);
      before += state.anaMag[bin];
    }
    const floor = peak * 0.02;
    this.synFrom.fill(0);
    for (let bin = 0; bin <= bins; bin++) {
      if (state.anaMag[bin] < floor) continue;
      const index = Math.min(bins, Math.max(0, Math.round((state.anaFreq[bin] * ratio) / this.freqPerBin)));
      if (state.anaMag[bin] >= this.synFrom[index]) {
        this.synFrom[index] = state.anaMag[bin];
        state.synFreq[index] = state.anaFreq[bin] * ratio;
      }
      state.synMag[index] += state.anaMag[bin];
    }
    let after = 0;
    for (let bin = 0; bin <= bins; bin++) after += state.synMag[bin];
    const match = after > 0 ? before / after : 1;
    for (let bin = 0; bin <= bins; bin++) state.synMag[bin] *= match;
    this.fftReal.fill(0);
    this.fftImag.fill(0);
    for (let bin = 0; bin <= bins; bin++) {
      const deviation = state.synFreq[bin] / this.freqPerBin - bin;
      state.sumPhase[bin] += (Math.PI * 2 * deviation) / this.osamp + bin * this.expected;
      const phase = state.sumPhase[bin];
      const magnitude = state.synMag[bin];
      this.fftReal[bin] = magnitude * Math.cos(phase);
      this.fftImag[bin] = magnitude * Math.sin(phase);
      if (bin > 0 && bin < bins) {
        this.fftReal[this.fftSize - bin] = this.fftReal[bin];
        this.fftImag[this.fftSize - bin] = -this.fftImag[bin];
      }
    }
    transform(this.fftReal, this.fftImag, true);
    const gain = 0.54;
    for (let i = 0; i < this.fftSize; i++) state.output[i] += this.fftReal[i] * this.hann[i] * gain;
  }
}

export const pitchLatencySamples = 3072;

if (typeof registerProcessor === "function") {
  class PitchShiftProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const steps = Math.min(12, Math.max(-12, Math.round(Number(options?.processorOptions?.semitones) || 0)));
      this.engine = new PitchEngine(sampleRate, 2);
      this.latency = this.engine.latency;
      this.dry = [new Float32Array(this.latency), new Float32Array(this.latency)];
      this.dryAt = 0;
      this.mix = steps === 0 ? 0 : 1;
      this.targetMix = this.mix;
      this.engine.setSteps(steps);
      this.port.onmessage = (event) => {
        const next = Math.min(12, Math.max(-12, Math.round(Number(event.data) || 0)));
        this.targetMix = next === 0 ? 0 : 1;
        this.engine.glideSteps(next);
      };
    }

    process(inputs, outputs) {
      const input = inputs[0];
      const output = outputs[0];
      const frames = input?.[0]?.length ?? 0;
      if (!frames || !output?.[0]) return true;
      const mixStep = 1 / (sampleRate * 0.02);
      for (let i = 0; i < frames; i++) {
        if (this.mix < this.targetMix) this.mix = Math.min(this.targetMix, this.mix + mixStep);
        else if (this.mix > this.targetMix) this.mix = Math.max(this.targetMix, this.mix - mixStep);
        const mix = this.mix;
        for (let channel = 0; channel < output.length; channel++) {
          const incoming = input[Math.min(channel, input.length - 1)]?.[i] ?? 0;
          const wet = channel < 2 ? this.engine.sample(channel, incoming) : 0;
          const dryLine = this.dry[Math.min(channel, this.dry.length - 1)];
          const dry = dryLine[this.dryAt];
          dryLine[this.dryAt] = incoming;
          output[channel][i] = dry * (1 - mix) + wet * mix;
        }
        this.dryAt += 1;
        if (this.dryAt >= this.latency) this.dryAt = 0;
      }
      return true;
    }
  }

  registerProcessor("pitch-shift", PitchShiftProcessor);
}

export function shiftChannels(channels, semitones, sampleRate, fftSize = 4096) {
  const steps = Math.min(12, Math.max(-12, Math.round(semitones)));
  const ratio = 2 ** (steps / 12);
  if (Math.abs(ratio - 1) < 0.0008) return channels.map((channel) => Float32Array.from(channel));
  const engine = new PitchEngine(sampleRate, channels.length, fftSize);
  engine.setRatio(ratio);
  const latency = engine.latency;
  const padded = channels.map((channel) => {
    const next = new Float32Array(channel.length + latency);
    next.set(channel);
    return next;
  });
  const shifted = engine.process(padded);
  return shifted.map((channel) => channel.slice(latency, latency + channels[0].length));
}
