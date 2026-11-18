"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function RowMenu({
  label,
  help,
  items,
}: {
  label: string;
  help?: string;
  items: { label: string; onSelect?: () => void; disabled?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function place() {
      const rect = menuRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = items.length * 28 + 8;
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight ? Math.max(8, rect.top - height - 6) : below;
      setBox({ top, right: Math.max(8, window.innerWidth - rect.right) });
    }
    place();
    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, items.length]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label={label}
        data-help={help}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="grid size-8 place-items-center rounded-lg text-muted outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover"
      >
        <Ellipsis />
      </button>
      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={{ top: box.top, right: box.right }}
              onPointerDown={(event) => event.stopPropagation()}
              className="fixed z-30 min-w-[7.5rem] overflow-hidden rounded-xl bg-surface-elevated py-1 shadow-[0_12px_28px_rgb(0_0_0/0.4)]"
            >
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
                  className="block w-full px-3 py-1 text-left text-[13px] leading-4 text-ink outline-none hover:bg-background focus-visible:bg-background disabled:text-disabled"
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
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
