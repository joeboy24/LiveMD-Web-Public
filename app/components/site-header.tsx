"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FiBell, FiCheckSquare, FiHelpCircle, FiMenu, FiMessageSquare, FiMusic, FiX } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";
import type { IconType } from "react-icons";
import type { ReactNode } from "react";
import { readNoticeCount, subscribeNoticeCount } from "./notice-count";
import { chooseFeature, type SideFeature } from "./panel";

const links: { href: string; label: string; icon: IconType; help: string; current: (pathname: string) => boolean }[] = [
  { href: "/", label: "Shows", icon: FiMusic, help: "The shows and the arrangement.", current: (pathname) => pathname === "/" },
  { href: "/organization", label: "Organization", icon: LuBuilding2, help: "The organization, its seats, and its plan.", current: (pathname) => pathname.startsWith("/organization") },
];

const tools: { id: SideFeature; label: string; help: string; icon: IconType }[] = [
  { id: "notifications", label: "Notifications", help: "Open alerts for your seat.", icon: FiBell },
  { id: "tasks", label: "To-do", help: "Open the to-do list.", icon: FiCheckSquare },
  { id: "message", label: "Message", help: "Open a message and choose the seats that receive it.", icon: FiMessageSquare },
  { id: "help", label: "Help", help: "Open notes for the control under the pointer.", icon: FiHelpCircle },
];

export function SiteHeader({
  accountBar,
  buttonName,
  menuName,
}: {
  accountBar: ReactNode;
  buttonName: ReactNode;
  menuName: ReactNode;
}) {
  return <HeaderFrame pathname={usePathname()} accountBar={accountBar} buttonName={buttonName} menuName={menuName} />;
}

function HeaderFrame({
  pathname,
  accountBar,
  buttonName,
  menuName,
}: {
  pathname: string | null;
  accountBar: ReactNode;
  buttonName: ReactNode;
  menuName: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="relative z-[60] border-b border-surface-elevated bg-surface">
      <div className="flex w-full items-center gap-3 py-3 pr-4 pl-4 md:gap-5 md:py-3.5">
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          data-help="Open Shows, Organization, and the tools."
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-xl text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover md:hidden"
        >
          <FiMenu aria-hidden className="size-5" />
        </button>
        <Link href="/" data-help="Live MD. Opens the shows." className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">
          <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-primary text-white shadow-[0_8px_18px_rgb(7_111_191/0.45)]">
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.28),transparent_58%)]" />
            <Waveform />
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">
            Live<span className="text-primary-hover pl-0.5">MD</span>
          </span>
        </Link>
        <span aria-hidden className="hidden h-6 w-px bg-surface-elevated md:block" />
        <nav className="hidden items-center gap-0.5 rounded-full bg-background p-0.5 ring-1 ring-surface-elevated md:flex" aria-label="Site">
          {links.map((link) => (
            <SiteLink key={link.href} link={link} pathname={pathname} />
          ))}
        </nav>
        <div className="ml-auto">{accountBar}</div>
      </div>
      {open ? <SideMenu pathname={pathname} onClose={() => setOpen(false)} /> : null}
    </header>
  );
}

function SiteLink({
  link,
  pathname,
  onClose,
}: {
  link: (typeof links)[number];
  pathname: string | null;
  onClose?: () => void;
}) {
  const selected = pathname !== null && link.current(pathname);
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      data-help={link.help}
      aria-current={selected ? "page" : undefined}
      onClick={onClose}
      className={
        onClose
          ? `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${selected ? "bg-primary text-white" : "text-ink hover:bg-background"}`
          : selected
            ? "flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgb(7_111_191/0.42)] outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
            : "flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold text-muted outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
      }
    >
      <Icon aria-hidden className={onClose ? "size-4" : "size-3.5"} />
      {link.label}
    </Link>
  );
}

function SideMenu({ pathname, onClose }: { pathname: string | null; onClose: () => void }) {
  const mark = useSyncExternalStore(subscribeNoticeCount, readNoticeCount, () => "none" as const);
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-[0_18px_40px_rgb(0_0_0/0.35)]">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">MENU</p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <FiX aria-hidden className="size-4" />
          </button>
        </div>
        <nav className="grid gap-1 px-3" aria-label="Site">
          {links.map((link) => (
            <SiteLink key={link.href} link={link} pathname={pathname} onClose={onClose} />
          ))}
        </nav>
        <p className="px-4 pt-5 pb-1 text-[11px] font-semibold tracking-[0.16em] text-muted">TOOLS</p>
        <div className="grid gap-1 px-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                data-help={tool.help}
                onClick={() => {
                  chooseFeature(tool.id);
                  onClose();
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                <Icon aria-hidden className="size-4" />
                <span className="flex-1">{tool.label}</span>
                {tool.id === "notifications" && mark !== "none" ? (
                  <span className={`size-1.5 rounded-full ${mark === "system" ? "bg-[#e85d4c]" : "bg-[#25C290]"}`} />
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function Waveform() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M1 7h2v2H1zm3-3h2v8H4zm3-2h2v12H7zm3 3h2v6h-2zm3 1h2v4h-2z" />
    </svg>
  );
}
