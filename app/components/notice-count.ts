"use client";

export type NoticeMark = "none" | "new" | "system";

let mark: NoticeMark = "none";
const listeners = new Set<() => void>();

export function subscribeNoticeCount(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readNoticeCount() {
  return mark;
}

export function setNoticeCount(next: NoticeMark) {
  if (next === mark) return;
  mark = next;
  for (const listener of listeners) listener();
}
