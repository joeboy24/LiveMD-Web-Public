import type { ComponentProps } from "react";

export function PrimaryButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`h-11 rounded-xl bg-primary px-4 text-[15px] font-semibold text-white outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-hover disabled:bg-disabled disabled:hover:bg-disabled ${className}`}
    />
  );
}
