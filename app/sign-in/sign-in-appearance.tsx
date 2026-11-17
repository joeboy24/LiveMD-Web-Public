"use client";

import { useEffect } from "react";
import { followSystemTheme, restoreStoredTheme } from "../theme";

export function SignInAppearance() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const paint = () => followSystemTheme();
    paint();
    media.addEventListener("change", paint);
    return () => {
      media.removeEventListener("change", paint);
      restoreStoredTheme();
    };
  }, []);

  return null;
}
