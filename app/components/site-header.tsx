"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiMusic, FiShield, FiUsers } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";
import type { IconType } from "react-icons";
import { AccountBar } from "./account-bar";

const links: { href: string; label: string; icon: IconType }[] = [
  { href: "/", label: "Shows", icon: FiMusic },
  { href: "/organization", label: "Organization", icon: LuBuilding2 },
  { href: "/organization/seats", label: "Seats", icon: FiUsers },
  { href: "/organization/roles", label: "Roles", icon: FiShield },
];

export function HeaderFallback() {
  return <HeaderFrame pathname={null} />;
}

export function SiteHeader() {
  return <HeaderFrame pathname={usePathname()} />;
}

function HeaderFrame({ pathname }: { pathname: string | null }) {
  return (
    <header className="border-b border-surface-elevated bg-surface">
      <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 py-2.5 pr-4 pl-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">
          <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-primary text-white shadow-[0_8px_18px_rgb(7_111_191/0.45)]">
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.28),transparent_58%)]" />
            <Waveform />
          </span>
          <span className="text-[20px] font-bold tracking-tight text-ink">
            Live <span className="text-primary-hover">MD</span>
          </span>
        </Link>
        <span aria-hidden className="hidden h-6 w-px bg-surface-elevated sm:block" />
        <nav className="flex flex-wrap items-center gap-0.5 rounded-full bg-background p-1 ring-1 ring-surface-elevated" aria-label="Site">
          {links.map((link) => {
            const selected = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={selected ? "page" : undefined}
                className={
                  selected
                    ? "flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[14px] font-semibold text-white shadow-[0_6px_16px_rgb(7_111_191/0.42)] outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
                    : "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold text-muted outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
                }
              >
                <Icon aria-hidden className="size-3.5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        {pathname === null ? <span className="ml-auto h-9 w-44" /> : <div className="ml-auto"><AccountBar /></div>}
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
