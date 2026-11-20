import { VoiceTrials } from "./trials";

const voices = ["en-US-Chirp3-HD-Aoede", "en-US-Chirp3-HD-Kore", "en-US-Chirp3-HD-Leda", "en-US-Chirp3-HD-Zephyr"].map((name) => ({
  name,
  label: name.replace("en-US-Chirp3-HD-", ""),
}));

export default function VoicePreview() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="text-[22px] font-semibold text-ink">Voice trial</h1>
        <p className="mt-1 text-[13px] text-muted">Four female voices. These clips are not saved with the show.</p>
        <VoiceTrials voices={voices} lines={["Intro", "Lead vocal in"]} />
      </div>
    </main>
  );
}
