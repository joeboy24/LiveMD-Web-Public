"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwitch } from "./theme-switch";

const links = [
  { href: "/", label: "Shows" },
  { href: "/organization", label: "Organization" },
  { href: "/organization/seats", label: "Seats" },
  { href: "/organization/roles", label: "Roles" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-surface-elevated bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-7">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">
          <span className="grid size-[34px] place-items-center rounded-lg bg-primary text-white">
            <Waveform />
          </span>
          <span className="text-[22px] font-bold tracking-tight text-ink">Live MD</span>
        </Link>
        <nav className="flex flex-wrap gap-1" aria-label="Site">
          {links.map((link) => {
            const selected = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={selected ? "page" : undefined}
                className={
                  selected
                    ? "rounded-[9px] bg-primary px-3 py-2 text-[15px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
                    : "rounded-[9px] px-3 py-2 text-[15px] font-semibold text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <ThemeSwitch />
      </div>
    </header>
  );
}

function Waveform() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M1 7h2v2H1zm3-3h2v8H4zm3-2h2v12H7zm3 3h2v6h-2zm3 1h2v4h-2z" />
    </svg>
  );
}
