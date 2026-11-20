"use client";

import { useRef, useState } from "react";

type Voice = { name: string; label: string };

export function VoiceTrials({ voices, lines }: { voices: Voice[]; lines: string[] }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play(voice: string, text: string) {
    const mark = `${voice}|${text}`;
    setFailed(null);
    audioRef.current?.pause();
    setPlaying(mark);
    try {
      const response = await fetch("/api/voice-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voice, text }),
      });
      if (!response.ok) {
        setFailed(mark);
        setPlaying(null);
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlaying((current) => (current === mark ? null : current));
      };
      await audio.play();
    } catch {
      setFailed(mark);
      setPlaying(null);
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      {lines.map((line) => (
        <section key={line} className="rounded-2xl bg-surface p-4">
          <h2 className="text-[17px] font-semibold text-ink">{line}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {voices.map((voice) => {
              const mark = `${voice.name}|${line}`;
              const on = playing === mark;
              return (
                <button
                  key={voice.name}
                  type="button"
                  onClick={() => void play(voice.name, line)}
                  className={`h-10 rounded-[10px] text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${on ? "bg-primary text-white" : failed === mark ? "bg-[#e4372d]/15 text-[#e4372d]" : "bg-background text-ink"}`}
                >
                  {on ? "Playing" : voice.label}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
