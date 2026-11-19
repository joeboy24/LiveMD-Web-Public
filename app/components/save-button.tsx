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
  const height = hasUtility(className, "h-") ? "" : "h-8";
  const radius = hasUtility(className, "rounded-") ? "" : "rounded-lg";
  return (
    <button
      type="submit"
      {...props}
      className={`inline-flex ${height} ${radius} items-center gap-1.5 bg-primary px-2.5 text-[13px] font-semibold text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover disabled:bg-disabled disabled:hover:bg-disabled ${className}`}
    >
      <Icon aria-hidden className="size-3.5" />
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}

function hasUtility(className: string, token: string) {
  return className.split(/\s+/).some((item) => (item.split(":").pop() ?? "").startsWith(token));
}
