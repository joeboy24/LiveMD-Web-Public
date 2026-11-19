"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Prices" },
  { href: "/admin/discounts", label: "Discounts" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="System" className="flex gap-6 border-b border-surface-elevated">
      {links.map((link) => {
        const selected = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={selected ? "page" : undefined}
            className={
              selected
                ? "-mb-px border-b-2 border-primary pb-3 text-[14px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
                : "-mb-px border-b-2 border-transparent pb-3 text-[14px] font-semibold text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
