"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readThemePreference, THEME_EVENT, type ThemePreference } from "../theme";

const options: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

export function ThemeSwitch() {
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => "system" as const);

  return (
    <div className="flex rounded-[9px] bg-background p-0.5" role="group" aria-label="Appearance">
      {options.map((option) => {
        const selected = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => applyTheme(option.value)}
            className={`flex-1 rounded-[7px] px-2 py-1.5 text-[13px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${
              selected ? "bg-primary text-white" : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
