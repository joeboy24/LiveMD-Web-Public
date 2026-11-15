import { pitchLatencySamples } from "../../public/pitch-worklet.mjs";

const modules = new WeakMap<AudioContext, Promise<void>>();

export { pitchLatencySamples };

export function loadPitch(context: AudioContext) {
  let loading = modules.get(context);
  if (!loading) {
    loading = context.audioWorklet.addModule("/pitch-worklet.mjs");
    modules.set(context, loading);
  }
  return loading;
}

export function createPitch(context: AudioContext, semitones: number) {
  const node = new AudioWorkletNode(context, "pitch-shift", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    channelCount: 2,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
    processorOptions: { semitones },
  });
  return node;
}
