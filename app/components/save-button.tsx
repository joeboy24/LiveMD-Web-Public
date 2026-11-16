import type { ComponentProps } from "react";
import { FiCheck } from "react-icons/fi";
import type { IconType } from "react-icons";

export function SaveButton({
  pending = false,
  pendingLabel = "Saving",
  icon: Icon = FiCheck,
  children = "Save",
  className = "",
  ...props
}: ComponentProps<"button"> & { pending?: boolean; pendingLabel?: string; icon?: IconType }) {
  return (
    <button
      type="submit"
      {...props}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[13px] font-semibold text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover disabled:bg-disabled disabled:hover:bg-disabled ${className}`}
    >
      <Icon aria-hidden className="size-3.5" />
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}
