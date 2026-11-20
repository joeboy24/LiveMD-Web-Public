export type StageDevice = {
  name: string;
  outputs: number;
  labeled: boolean;
};

type OutputPicker = MediaDevices & {
  selectAudioOutput?: () => Promise<MediaDeviceInfo>;
};

type SinkContext = AudioContext & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

export async function connectedDevice(): Promise<StageDevice> {
  const listed = await outputDevices();
  const active = activeOutput(listed, chosenId);
  const bare = await channelCount();
  const targeted = active.id ? await channelCount(active.id) : bare;
  return { name: active.name, outputs: Math.max(bare, targeted), labeled: active.labeled };
}

let naming: Promise<boolean> | null = null;

export function allowOutputNames() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return Promise.resolve(false);
  if (!naming) {
    naming = requestOutputNames().finally(() => {
      naming = null;
    });
  }
  return naming;
}

async function requestOutputNames() {
  if (await outputNamesVisible()) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export async function outputAccessGranted() {
  if (typeof navigator === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia) return true;
  try {
    const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    if (status?.state === "granted") return true;
    if (status?.state === "prompt" || status?.state === "denied") return false;
  } catch {
    // This browser does not report microphone permission.
  }
  return outputNamesVisible();
}

async function outputNamesVisible() {
  const listed = await outputDevices();
  return listed.some((device) => device.label);
}

export async function revealDeviceName(): Promise<StageDevice> {
  if (canChooseDevice()) {
    const chosen = await chooseDevice();
    if (chosen) return chosen;
    return connectedDevice();
  }
  await allowOutputNames();
  return connectedDevice();
}

export async function chooseDevice(): Promise<StageDevice | null> {
  const media = navigator.mediaDevices as OutputPicker | undefined;
  if (!media?.selectAudioOutput) return null;
  try {
    const device = await media.selectAudioOutput();
    chosenId = device.deviceId;
    const name = cleanLabel(device.label);
    return {
      name: name || "Connected output",
      outputs: await channelCount(device.deviceId),
      labeled: Boolean(name),
    };
  } catch {
    return null;
  }
}

export function canChooseDevice() {
  return typeof navigator !== "undefined" && typeof (navigator.mediaDevices as OutputPicker | undefined)?.selectAudioOutput === "function";
}

const placed = new WeakMap<AudioNode, { index: number; router: AudioNode; mono: GainNode }>();
const routerReady = new WeakSet<AudioContext>();
const routerLoading = new WeakMap<AudioContext, Promise<void>>();
let chosenId: string | null = null;

export function performanceContext(current: AudioContext | null) {
  const max = current ? clamp(current.destination.maxChannelCount || 2) : 0;
  if (current && current.state !== "closed" && current.destination.channelInterpretation === "discrete" && current.destination.channelCount >= max) {
    return current;
  }
  if (current && current.state !== "closed") void current.close();
  const context = new AudioContext();
  applyHardwareChannels(context);
  return context;
}

export function primeOutputs(context: AudioContext) {
  applyHardwareChannels(context);
  void context.resume();
}

export async function useOutputDevice(context: AudioContext) {
  applyHardwareChannels(context);
  const resumed = context.state === "running" ? Promise.resolve() : context.resume();
  try {
    await loadRouter(context);
  } catch {
    // The merger fallback still keeps one bus on each output.
  }
  prepareOutputs(context);
  applyHardwareChannels(context);
  await resumed;
}

export function connectBus(node: AudioNode, context: AudioContext, output: number) {
  const bus = prepareOutputs(context);
  const index = Math.min(bus.count - 1, Math.max(0, Math.round(output)));
  const current = placed.get(node);
  if (current?.router === bus.input && current.index === index) return;
  try {
    node.disconnect();
  } catch {
    // The node has not been connected yet.
  }
  try {
    current?.mono.disconnect();
  } catch {
    // The previous tap is already gone.
  }
  const mono = context.createGain();
  mono.channelCountMode = "explicit";
  mono.channelInterpretation = "speakers";
  mono.channelCount = 1;
  node.connect(mono);
  mono.connect(bus.input, 0, index);
  placed.set(node, { index, router: bus.input, mono });
}

function prepareOutputs(context: AudioContext) {
  const count = applyHardwareChannels(context);
  const destination = context.destination;
  let current = routed.get(context);
  if (current && current.count === count && (!routerReady.has(context) || current.output instanceof AudioWorkletNode)) return current;
  try {
    current?.output.disconnect();
  } catch {
    // The previous router was not connected.
  }
  const router = createRouter(context, count);
  router.output.connect(destination);
  current = { input: router.input, output: router.output, count };
  routed.set(context, current);
  return current;
}

const routed = new WeakMap<AudioContext, { input: AudioNode; output: AudioNode; count: number }>();

function applyHardwareChannels(context: AudioContext) {
  const destination = context.destination;
  const count = clamp(destination.maxChannelCount || destination.channelCount || 2);
  destination.channelCountMode = "explicit";
  try {
    if (destination.channelCount !== count) destination.channelCount = count;
  } catch {
    // The hardware kept the channel count it already opened with.
  }
  destination.channelInterpretation = "discrete";
  return clamp(destination.channelCount || count);
}

function loadRouter(context: AudioContext) {
  let loading = routerLoading.get(context);
  if (!loading) {
    loading = context.audioWorklet.addModule("/output-worklet.mjs?v=3").then(() => {
      routerReady.add(context);
    });
    routerLoading.set(context, loading);
  }
  return loading;
}

function createRouter(context: AudioContext, count: number) {
  const input = context.createChannelMerger(count);
  input.channelInterpretation = "discrete";
  if (routerReady.has(context)) {
    try {
      const output = new AudioWorkletNode(context, "output-router", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [count],
        channelCount: count,
        channelCountMode: "explicit",
        channelInterpretation: "discrete",
      });
      input.connect(output);
      return { input, output };
    } catch {
      // The merger still places one mono bus on each output.
    }
  }
  return { input, output: input };
}

function activeOutput(devices: MediaDeviceInfo[], preferred: string | null) {
  const outputs = devices.filter((device) => device.kind === "audiooutput");
  const picked = preferred ? outputs.find((device) => device.deviceId === preferred && device.label) : undefined;
  if (picked) return { name: cleanLabel(picked.label), id: picked.deviceId, labeled: true };
  const fallback = outputs.find((device) => device.deviceId === "default");
  const suffix = cleanLabel(fallback?.label ?? "");
  const match = suffix
    ? outputs.find((device) => device.deviceId !== "default" && device.deviceId !== "communications" && cleanLabel(device.label) === suffix)
    : undefined;
  if (match) return { name: cleanLabel(match.label), id: match.deviceId, labeled: true };
  const named = outputs.find((device) => device.label && device.deviceId !== "default" && device.deviceId !== "communications");
  if (named) return { name: cleanLabel(named.label), id: named.deviceId, labeled: true };
  if (suffix) return { name: suffix, id: undefined, labeled: true };
  return { name: "Default output", id: undefined, labeled: false };
}

function cleanLabel(label: string) {
  return label.replace(/^(Default|Communications)\s+-\s+/, "").trim();
}

async function outputDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "audiooutput");
  } catch {
    return [];
  }
}

async function channelCount(deviceId?: string) {
  const context = new AudioContext();
  try {
    const sink = (context as SinkContext).setSinkId;
    if (deviceId && sink) await sink.call(context, deviceId);
    return clamp(context.destination.maxChannelCount || 2);
  } catch {
    return clamp(context.destination.maxChannelCount || 2);
  } finally {
    await context.close();
  }
}

function clamp(count: number) {
  return Math.min(32, Math.max(2, Math.round(count) || 2));
}
