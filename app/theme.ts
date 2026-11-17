export const THEME_KEY = "livemd-theme";
export const THEME_EVENT = "livemd-theme";

export type Theme = "dark" | "light";
export type ThemePreference = Theme | "system";

export function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function readThemePreference(): ThemePreference {
  const preference = document.documentElement.dataset.themePreference;
  if (preference === "light" || preference === "dark" || preference === "system") return preference;
  return storedPreference();
}

export function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference === "system" ? systemTheme() : preference;
  document.documentElement.dataset.themePreference = preference;
  localStorage.setItem(THEME_KEY, preference);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function followSystemTheme() {
  document.documentElement.dataset.theme = systemTheme();
  document.documentElement.dataset.themePreference = "system";
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function restoreStoredTheme() {
  applyTheme(storedPreference());
}

function storedPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}
