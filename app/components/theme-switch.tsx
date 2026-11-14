"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readTheme, THEME_EVENT, type Theme } from "../theme";

const options: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as const);

  return (
    <div className="flex rounded-[9px] bg-background p-0.5" role="group" aria-label="Appearance">
      {options.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => applyTheme(option.value)}
            className={
              option.value === "dark"
                ? "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover in-data-[theme=dark]:bg-primary in-data-[theme=dark]:text-white in-data-[theme=dark]:hover:text-white [:root:not([data-theme])_&]:bg-primary [:root:not([data-theme])_&]:text-white"
                : "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover in-data-[theme=light]:bg-primary in-data-[theme=light]:text-white in-data-[theme=light]:hover:text-white"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
