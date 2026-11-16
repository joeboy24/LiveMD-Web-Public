export const PERFORMANCE_MODE_KEY = "livemd-mode";
export const PERFORMANCE_MODE_EVENT = "livemd-mode";

export function performanceModeFrom(value: string | undefined | null) {
  return value === "rehearsal";
}

export function readPerformanceMode() {
  if (typeof document === "undefined") return false;
  const parts = document.cookie.split("; ");
  const entry = parts.find((part) => part.startsWith(`${PERFORMANCE_MODE_KEY}=`));
  return performanceModeFrom(entry?.slice(PERFORMANCE_MODE_KEY.length + 1));
}

export function writePerformanceMode(rehearsal: boolean) {
  const value = rehearsal ? "rehearsal" : "production";
  document.cookie = `${PERFORMANCE_MODE_KEY}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(PERFORMANCE_MODE_EVENT));
}

export function clearPerformanceMode() {
  document.cookie = `${PERFORMANCE_MODE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  window.dispatchEvent(new Event(PERFORMANCE_MODE_EVENT));
}
