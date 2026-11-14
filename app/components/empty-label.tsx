import type { ReactNode } from "react";
import { FiAlertCircle } from "react-icons/fi";

export function EmptyLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-surface-elevated bg-surface px-4 py-4 text-center text-[14px] leading-5 text-muted ${className ?? ""}`}
    >
      <FiAlertCircle aria-hidden className="size-4 shrink-0 text-[#e8a317]" />
      <span>{children}</span>
    </p>
  );
}
