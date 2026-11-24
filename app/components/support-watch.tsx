"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiMessageCircle } from "react-icons/fi";
import { supportPulse } from "../(main)/organization/notification-actions";
import { setNoticeCount } from "./notice-count";

const wait = 4000;
const stay = 10000;

type Chat = { line: string; text: string };

export function SupportWatch() {
  const [chat, setChat] = useState<Chat | null>(null);

  useEffect(() => {
    let live = true;
    let ready = false;
    let seen = "";
    let timer = 0;

    armChime();

    async function tick() {
      if (document.hidden) return;
      const pulse = await supportPulse();
      if (!live) return;
      const open = pulse.open;
      if (!ready) {
        ready = true;
        seen = open;
        if (open) setNoticeCount("system");
        if (open && open !== heardOpen()) {
          rememberOpen(open);
          playChime();
          setChat(chatFrom(pulse.title, pulse.body));
          window.dispatchEvent(new Event("livemd-notices"));
        }
        return;
      }
      if (open === seen) return;
      const before = new Set(seen.split(",").filter(Boolean));
      seen = open;
      const arrived = open.split(",").filter((id) => id && !before.has(id));
      if (arrived.length === 0) {
        rememberOpen(open);
        return;
      }
      if (open === heardOpen()) return;
      rememberOpen(open);
      playChime();
      setNoticeCount("system");
      setChat(chatFrom(pulse.title, pulse.body));
      window.dispatchEvent(new Event("livemd-notices"));
    }

    function onVisible() {
      if (!document.hidden) void tick();
    }

    void tick();
    timer = window.setInterval(() => void tick(), wait);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!chat) return;
    const id = window.setTimeout(() => setChat(null), stay);
    return () => window.clearTimeout(id);
  }, [chat]);

  if (!chat) return null;
  return <SupportChat line={chat.line} text={chat.text} />;
}

export function SupportChat({ line, text }: Chat) {
  const [box, setBox] = useState<HTMLElement | null>(null);
  useEffect(() => setBox(document.body), []);
  if (!box) return null;
  return createPortal(
    <Link
      href="/admin/support"
      className="flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl bg-surface px-3.5 py-3 text-left shadow-[0_18px_50px_rgb(0_0_0/0.45)] ring-1 ring-surface-elevated outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
      style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 2147483000 }}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#25C290] text-[#0B1116]">
        <FiMessageCircle aria-hidden className="size-4" />
      </span>
      <span className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">SUPPORT</p>
        <p className="mt-1 truncate text-[13px] font-semibold text-ink">{line}</p>
        <p className="mt-1 line-clamp-3 text-[14px] leading-5 text-ink">{text}</p>
      </span>
    </Link>,
    box,
  );
}

function chatFrom(title: string, body: string): Chat {
  const [line, ...rest] = body.split("\n");
  const text = rest.join("\n").trim();
  if (text) return { line: line.trim() || title || "Support", text };
  return { line: title || "Support", text: body.trim() || "New support message." };
}

const heardKey = "livemd-support-open";

function heardOpen() {
  try {
    return sessionStorage.getItem(heardKey) ?? "";
  } catch {
    return "";
  }
}

function rememberOpen(open: string) {
  try {
    sessionStorage.setItem(heardKey, open);
  } catch {
    /* Private browsing can block storage. The in-memory check still covers this page. */
  }
}

let clip: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let armed = false;
let token = 0;

function beepUrl() {
  const rate = 44100;
  const seconds = 0.46;
  const count = Math.floor(rate * seconds);
  const pcm = new Int16Array(count);
  for (const [start, dur, freq] of [
    [0, 0.16, 880],
    [0.13, 0.2, 1318],
  ] as const) {
    const from = Math.floor(start * rate);
    const length = Math.floor(dur * rate);
    for (let i = 0; i < length; i++) {
      const env = Math.sin((Math.PI * i) / length);
      const sample = Math.sin((2 * Math.PI * freq * i) / rate) * env * 0.45;
      const at = from + i;
      const mixed = pcm[at] / 32767 + sample;
      pcm[at] = Math.max(-32767, Math.min(32767, Math.round(mixed * 32767)));
    }
  }
  const bytes = count * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, bytes, true);
  let offset = 44;
  for (let i = 0; i < count; i++) {
    view.setInt16(offset, pcm[i], true);
    offset += 2;
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function clipAudio() {
  if (!clip) {
    clip = new Audio(beepUrl());
    clip.preload = "auto";
    clip.setAttribute("playsinline", "true");
  }
  return clip;
}

function audioContext() {
  const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  context ??= new Ctx();
  return context;
}

function playOscillator() {
  const current = audioContext();
  if (!current) return Promise.resolve(false);
  const start = () => {
    const now = current.currentTime;
    const gain = current.createGain();
    gain.connect(current.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + 0.42);
    for (const [offset, freq] of [
      [0, 880],
      [0.12, 1320],
    ] as const) {
      const tone = current.createOscillator();
      tone.type = "sine";
      tone.frequency.setValueAtTime(freq, now);
      tone.connect(gain);
      tone.start(now + offset);
      tone.stop(now + offset + 0.18);
    }
  };
  if (current.state === "running") {
    start();
    return Promise.resolve(true);
  }
  return current.resume().then(() => {
    if (current.state !== "running") return false;
    start();
    return true;
  }).catch(() => false);
}

let playing = false;

export function playChime() {
  if (playing) return Promise.resolve(true);
  playing = true;
  window.setTimeout(() => {
    playing = false;
  }, 700);
  token += 1;
  try {
    const audio = clipAudio();
    audio.volume = 1;
    try {
      audio.currentTime = 0;
    } catch {
      /* The clip is not seekable until the browser has its header. */
    }
    const attempt = audio.play();
    if (!attempt) return playOscillator();
    return attempt.then(() => true).catch(() => playOscillator());
  } catch {
    return playOscillator();
  }
}

function armChime() {
  if (armed) return;
  armed = true;
  const unlock = () => {
    const mine = token;
    const current = audioContext();
    if (current?.state === "suspended") void current.resume();
    const audio = clipAudio();
    audio.volume = 0;
    const attempt = audio.play();
    const reset = () => {
      if (token !== mine) return;
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
    };
    if (attempt) void attempt.then(reset).catch(reset);
    else reset();
  };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });
}
