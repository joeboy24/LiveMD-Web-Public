// A bar click is a short high tone. Other beats are quieter and lower, matching the player.
export function writeClick(samples: Float32Array, start: number, sampleRate: number, accent: boolean) {
  const frequency = accent ? 1760 : 1174;
  const amplitude = accent ? 0.55 : 0.28;
  const length = Math.floor(0.025 * sampleRate);
  const decay = 0.004 * sampleRate;
  for (let index = 0; index < length; index += 1) {
    const frame = start + index;
    if (frame >= samples.length) return;
    const envelope = Math.exp(-index / decay);
    const phase = (2 * Math.PI * frequency * index) / sampleRate;
    samples[frame] += amplitude * envelope * Math.sin(phase);
  }
}

export function makeClickBuffer(context: AudioContext, bars: number, beatsPerBar: number, tempo: number) {
  const sampleRate = context.sampleRate;
  const beatFrames = (sampleRate * 60) / tempo;
  const frameCount = Math.max(1, Math.round(bars * beatsPerBar * beatFrames));
  const buffer = context.createBuffer(1, frameCount, sampleRate);
  const samples = buffer.getChannelData(0);
  for (let bar = 0; bar < bars; bar += 1) {
    for (let beat = 0; beat < beatsPerBar; beat += 1) {
      writeClick(samples, Math.round((bar * beatsPerBar + beat) * beatFrames), sampleRate, beat === 0);
    }
  }
  return buffer;
}
