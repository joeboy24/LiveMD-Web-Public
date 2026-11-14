"use client";

import { useEffect, useRef, useState } from "react";

export function RowMenu({
  label,
  items,
}: {
  label: string;
  items: { label: string; onSelect?: () => void; disabled?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", closeOnOutside);
    return () => window.removeEventListener("pointerdown", closeOnOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="grid size-8 place-items-center rounded-lg text-muted outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover"
      >
        <Ellipsis />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-10 min-w-40 rounded-xl bg-surface-elevated py-1 shadow-[0_12px_32px_rgb(0_0_0/0.35)]">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect?.();
              }}
              className="block w-full px-4 py-2 text-left text-[16px] text-ink outline-none hover:bg-background focus-visible:bg-background disabled:text-disabled"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Ellipsis() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M3.2 6.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Zm4.8 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Zm4.8 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z" />
    </svg>
  );
}
