"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiEdit2, FiLogIn, FiLogOut, FiUser } from "react-icons/fi";
import { signOut } from "../auth/actions";
import type { SessionAccount } from "../auth/queries";
import { clearPerformanceMode } from "../shows/performance-mode";
import { ThemeSwitch } from "./theme-switch";

export function AccountBar({
  account,
  role = null,
  buttonName,
  menuName,
}: {
  account: SessionAccount | null;
  role?: string | null;
  buttonName: ReactNode;
  menuName: ReactNode;
}) {
  const [menu, setMenu] = useState<"organization" | "profile" | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    function closeOnOutside(event: PointerEvent) {
      if (!barRef.current?.contains(event.target as Node)) setMenu(null);
    }
    window.addEventListener("pointerdown", closeOnOutside);
    return () => window.removeEventListener("pointerdown", closeOnOutside);
  }, [menu]);

  return (
    <div ref={barRef} className="relative flex items-center gap-2">
      <div className="relative hidden md:block">
        <button
          type="button"
          aria-expanded={menu === "organization"}
          aria-haspopup="menu"
          data-help="The organization. Open it to switch the pages for seats, roles, and the plan."
          onClick={() => setMenu((current) => (current === "organization" ? null : "organization"))}
          className="flex h-9 items-center gap-2 rounded-full bg-background px-4 text-[14px] font-semibold text-ink outline-none hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          {buttonName}
          <FiChevronDown aria-hidden className={`size-4 text-muted transition-transform ${menu === "organization" ? "rotate-180" : ""}`} />
        </button>
        {menu === "organization" ? <OrganizationMenu name={menuName} onClose={() => setMenu(null)} /> : null}
      </div>
      <div className="relative">
        <button
          type="button"
          aria-label="Account"
          data-help="This seat. Profile, appearance, and sign out are here."
          aria-expanded={menu === "profile"}
          aria-haspopup="menu"
          onClick={() => setMenu((current) => (current === "profile" ? null : "profile"))}
          className="grid size-9 place-items-center rounded-full bg-surface-elevated text-ink outline-none ring-2 ring-background hover:text-primary-hover focus-visible:ring-primary-hover"
        >
          <FiUser aria-hidden className="size-4" />
        </button>
        {menu === "profile" ? <ProfileMenu account={account} role={role} onClose={() => setMenu(null)} /> : null}
      </div>
    </div>
  );
}

function OrganizationMenu({ name, onClose }: { name: ReactNode; onClose: () => void }) {
  return (
    <div role="menu" className="absolute right-0 top-11 z-20 w-64 overflow-hidden rounded-2xl bg-surface-elevated shadow-[0_16px_40px_rgb(0_0_0/0.4)]">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">ORGANIZATIONS</p>
      </div>
      <Link
        href="/organization"
        role="menuitem"
        onClick={onClose}
        className="block border-t border-background px-4 py-3 text-[15px] font-semibold text-ink outline-none hover:bg-background focus-visible:bg-background"
      >
        {name}
      </Link>
    </div>
  );
}

function ProfileMenu({ account, role, onClose }: { account: SessionAccount | null; role: string | null; onClose: () => void }) {
  const title = account ? account.name ?? account.email : "Account";
  const detail = account ? (role ? (account.name ? `${role} · ${account.email}` : role) : "Signed in") : "Sign in to take a seat.";
  return (
    <div role="menu" className="absolute right-0 top-11 z-20 w-72 overflow-hidden rounded-2xl bg-surface-elevated shadow-[0_16px_40px_rgb(0_0_0/0.4)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-ink">
          <FiUser aria-hidden className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-ink">{title}</span>
          <span className="block truncate text-[12px] text-muted">{detail}</span>
        </span>
      </div>
      {account ? (
        <Link
          href="/profile"
          role="menuitem"
          data-help="Your name, email, and password."
          onClick={onClose}
          className="flex items-center gap-3 border-t border-background px-4 py-3 text-[15px] font-semibold text-ink outline-none hover:bg-background focus-visible:bg-background"
        >
          <FiEdit2 aria-hidden className="size-4" />
          Profile
        </Link>
      ) : null}
      <div className="border-t border-background px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted">APPEARANCE</p>
        <ThemeSwitch />
      </div>
      {account ? <LogOut /> : <SignIn onClose={onClose} />}
    </div>
  );
}

function SignIn({ onClose }: { onClose: () => void }) {
  return (
    <Link
      href="/sign-in"
      role="menuitem"
      onClick={onClose}
      className="flex w-full items-center justify-between border-t border-background px-4 py-3 text-left text-[15px] text-ink outline-none hover:bg-background focus-visible:bg-background"
    >
      Sign in
      <FiLogIn aria-hidden className="size-4" />
    </Link>
  );
}

function LogOut() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        role="menuitem"
        onClick={() => clearPerformanceMode()}
        className="flex w-full items-center justify-between border-t border-background px-4 py-3 text-left text-[15px] text-ink outline-none hover:bg-background focus-visible:bg-background"
      >
        Log out
        <FiLogOut aria-hidden className="size-4" />
      </button>
    </form>
  );
}
