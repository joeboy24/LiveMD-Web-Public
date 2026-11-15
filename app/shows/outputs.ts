export type StageDevice = {
  name: string;
  outputs: number;
};

type OutputPicker = MediaDevices & {
  selectAudioOutput?: () => Promise<MediaDeviceInfo>;
};

type SinkContext = AudioContext & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

export async function connectedDevice(): Promise<StageDevice> {
  const listed = await outputDevices();
  const named = listed.find((device) => device.label && device.deviceId !== "default" && device.deviceId !== "communications");
  return {
    name: named?.label || "Default output",
    outputs: await channelCount(named?.deviceId),
  };
}

export async function chooseDevice(): Promise<StageDevice | null> {
  const media = navigator.mediaDevices as OutputPicker | undefined;
  if (!media?.selectAudioOutput) return null;
  try {
    const device = await media.selectAudioOutput();
    return {
      name: device.label || "Connected output",
      outputs: await channelCount(device.deviceId),
    };
  } catch {
    return null;
  }
}

export function canChooseDevice() {
  return typeof navigator !== "undefined" && typeof (navigator.mediaDevices as OutputPicker | undefined)?.selectAudioOutput === "function";
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
