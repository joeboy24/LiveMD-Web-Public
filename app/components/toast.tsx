"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiCheck, FiInfo } from "react-icons/fi";
import type { IconType } from "react-icons";

const stay = 4000;

export type ToastTone = "success" | "warning" | "info";

const tones: Record<ToastTone, { icon: IconType; color: string }> = {
  success: { icon: FiCheck, color: "#25C290" },
  warning: { icon: FiAlertTriangle, color: "#e8a317" },
  info: { icon: FiInfo, color: "#38A7E2" },
};

export function Toast({
  message,
  tone = "success",
  icon,
  onDone,
}: {
  message: string | null;
  tone?: ToastTone;
  icon?: IconType;
  onDone: () => void;
}) {
  const done = useRef(onDone);
  done.current = onDone;
  const kind = tones[tone];
  const Icon = icon ?? kind.icon;

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => done.current(), stay);
    return () => window.clearTimeout(id);
  }, [message, tone]);

  if (!message) return null;
  return createPortal(
    <div role="status" className="pointer-events-none fixed top-5 left-1/2 z-50 -translate-x-1/2">
      <style>{`
        @keyframes livemd-toast-in {
          from { opacity: 0; transform: translateY(-12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes livemd-toast-life {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
      <div
        className="relative overflow-hidden rounded-2xl bg-surface-elevated shadow-[0_18px_50px_rgb(0_0_0/0.45)]"
        style={{ animation: "livemd-toast-in 280ms ease-out", boxShadow: `0 18px 50px rgb(0 0 0 / 0.45), inset 0 0 0 1px ${kind.color}66` }}
      >
        <p className="flex items-center gap-2.5 px-3.5 py-2.5 pr-5">
          <span className="relative grid size-6 shrink-0 place-items-center overflow-hidden rounded-full text-[#0B1116]" style={{ backgroundColor: kind.color }}>
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.4),transparent_60%)]" />
            <Icon aria-hidden className="relative size-3.5" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-ink">{message}</span>
        </p>
        <span
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left"
          style={{ backgroundColor: kind.color, animation: `livemd-toast-life ${stay}ms linear` }}
        />
      </div>
    </div>,
    document.body,
  );
}
