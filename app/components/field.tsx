import type { ComponentProps } from "react";

export function Field({
  label,
  name,
  className = "",
  hideLabel = false,
  tone = "background",
  ...input
}: {
  label: string;
  name: string;
  className?: string;
  hideLabel?: boolean;
  tone?: "background" | "surface";
} & ComponentProps<"input">) {
  const fill = tone === "surface" ? "bg-surface" : "bg-background";
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className={hideLabel ? "sr-only" : "text-[13px] font-semibold text-muted"}>{label}</span>
      <input
        name={name}
        {...input}
        className={`h-12 rounded-xl ${fill} px-3 text-[15px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary-hover`}
      />
    </label>
  );
}

export function TextArea({
  label,
  name,
  className = "",
  tone = "background",
  ...area
}: {
  label: string;
  name: string;
  className?: string;
  tone?: "background" | "surface";
} & ComponentProps<"textarea">) {
  const fill = tone === "surface" ? "bg-surface" : "bg-background";
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <textarea
        name={name}
        {...area}
        className={`rounded-xl ${fill} px-3 py-2 text-[15px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary-hover`}
      />
    </label>
  );
}
