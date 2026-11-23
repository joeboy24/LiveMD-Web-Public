"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supportPulse } from "../(main)/organization/notification-actions";
import { setNoticeCount } from "./notice-count";

const wait = 4000;

type Chat = { line: string; text: string };

export function SupportWatch() {
  const [chat, setChat] = useState<Chat | null>(null);

  useEffect(() => {
    let live = true;
    let ready = false;
    let seen = "";
    let timer = 0;

    function unlock() {
      const context = chime();
      if (context.state === "suspended") void context.resume();
    }

    async function tick() {
      if (document.hidden) return;
      const pulse = await supportPulse();
      if (!live) return;
      if (!ready) {
        ready = true;
        seen = pulse.id;
        if (pulse.unread > 0) setNoticeCount("system");
        return;
      }
      if (pulse.id && pulse.id !== seen) {
        seen = pulse.id;
        playChime();
        setNoticeCount("system");
        setChat(chatFrom(pulse.title, pulse.body));
        window.dispatchEvent(new Event("livemd-notices"));
        return;
      }
      if (!pulse.id) seen = "";
    }

    function onVisible() {
      if (!document.hidden) void tick();
    }

    void tick();
    timer = window.setInterval(() => void tick(), wait);
    window.addEventListener("pointerdown", unlock);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", unlock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!chat) return;
    const id = window.setTimeout(() => setChat(null), 5000);
    return () => window.clearTimeout(id);
  }, [chat]);

  if (!chat) return null;
  return createPortal(
    <Link
      href="/admin/support"
      className="block w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-surface px-3.5 py-3 text-left shadow-[0_18px_50px_rgb(0_0_0/0.45)] ring-1 ring-surface-elevated outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
      style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 2147483000 }}
    >
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">SUPPORT</p>
      <p className="mt-1 truncate text-[13px] font-semibold text-ink">{chat.line}</p>
      <p className="mt-1 line-clamp-3 text-[14px] leading-5 text-ink">{chat.text}</p>
    </Link>,
    document.body,
  );
}

function chatFrom(title: string, body: string): Chat {
  const [line, ...rest] = body.split("\n");
  const text = rest.join("\n").trim();
  if (text) return { line: line.trim() || title || "Support", text };
  return { line: title || "Support", text: body.trim() || "New support message." };
}

let audio: AudioContext | null = null;

function chime() {
  audio ??= new AudioContext();
  return audio;
}

function playChime() {
  const context = chime();
  const start = () => {
    const now = context.currentTime;
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    for (const [offset, freq] of [[0, 880], [0.12, 1320]] as const) {
      const tone = context.createOscillator();
      tone.type = "sine";
      tone.frequency.value = freq;
      tone.connect(gain);
      tone.start(now + offset);
      tone.stop(now + offset + 0.16);
    }
  };
  if (context.state === "suspended") {
    void context.resume().then(start);
    return;
  }
  start();
}
