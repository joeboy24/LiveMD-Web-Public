"use client";

import { useEffect, useState } from "react";
import { allowOutputNames, outputAccessGranted } from "../shows/outputs";

export function AudioAccessBanner() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    let status: PermissionStatus | null = null;
    const refresh = () => {
      void outputAccessGranted().then((allowed) => {
        if (alive) setGranted(allowed);
      });
    };
    refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    void navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((next) => {
        if (!alive) return;
        status = next;
        next.onchange = refresh;
        refresh();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener("devicechange", refresh);
      if (status) status.onchange = null;
    };
  }, []);

  if (granted !== false) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void allowOutputNames().then((allowed) => setGranted(allowed));
      }}
      className="w-full shrink-0 bg-[#e4372d]/12 px-4 py-2 text-center text-[13px] font-semibold text-[#e4372d] outline-none focus-visible:ring-2 focus-visible:ring-[#e4372d]"
    >
      Click to allow device audio/microphone to hear audio
    </button>
  );
}
