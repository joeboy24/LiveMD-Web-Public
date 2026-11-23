export const systemPages = [
  { key: "prices", href: "/admin", label: "Prices", detail: "Plan prices, seats, storage, and the Personal trial." },
  { key: "discounts", href: "/admin/discounts", label: "Discounts", detail: "Codes that take money off a plan." },
  { key: "users", href: "/admin/users", label: "Users", detail: "System accounts and the pages they can open." },
] as const;

export type SystemPage = (typeof systemPages)[number]["key"];

const keys = new Set<string>(systemPages.map((page) => page.key));

export function systemPageFor(path: string) {
  return systemPages.find((page) => page.href === path) ?? null;
}

export function pagesFrom(values: Iterable<unknown>) {
  const chosen = new Set<SystemPage>();
  for (const value of values) {
    const key = String(value);
    if (keys.has(key)) chosen.add(key as SystemPage);
  }
  return systemPages.flatMap((page) => (chosen.has(page.key) ? [page.key] : []));
}

export function firstSystemHref(pages: readonly SystemPage[]) {
  return systemPages.find((page) => pages.includes(page.key))?.href ?? "/profile";
}

export function pageList(value: unknown): SystemPage[] | null {
  if (value == null) return null;
  const raw = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.replace(/^\{|\}$/g, "").split(",").map((item) => item.trim().replace(/^"|"$/g, "")).filter(Boolean)
      : [];
  return pagesFrom(raw);
}
