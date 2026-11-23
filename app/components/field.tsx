import type { ComponentProps } from "react";

export function Field({
  label,
  name,
  className = "",
  hideLabel = false,
  tone = "background",
  size = "md",
  ...input
}: {
  label: string;
  name: string;
  className?: string;
  hideLabel?: boolean;
  tone?: "background" | "surface";
  size?: "md" | "sm";
} & Omit<ComponentProps<"input">, "size">) {
  const fill = tone === "surface" ? "bg-surface" : "bg-background";
  const scale = size === "sm" ? "h-9 text-[13px]" : "h-12 text-[15px]";
  const locked = Boolean(input.readOnly);
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className={hideLabel ? "sr-only" : "text-[13px] font-semibold text-muted"}>{label}</span>
      <input
        name={name}
        {...input}
        className={`${scale} rounded-xl ${fill} px-3 outline-none placeholder:text-muted ${locked ? "cursor-default text-muted" : "text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"}`}
      />
    </label>
  );
}

export function TextArea({
  label,
  name,
  className = "",
  tone = "background",
  size = "md",
  ...area
}: {
  label: string;
  name: string;
  className?: string;
  tone?: "background" | "surface";
  size?: "md" | "sm";
} & ComponentProps<"textarea">) {
  const fill = tone === "surface" ? "bg-surface" : "bg-background";
  const scale = size === "sm" ? "text-[13px] leading-5" : "text-[15px]";
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <textarea
        name={name}
        {...area}
        className={`rounded-xl ${fill} px-3 py-2 ${scale} text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary-hover`}
      />
    </label>
  );
}
