import Link from "next/link";
import type { ReactNode } from "react";

export function ListRow({
  href,
  selected = false,
  leading,
  title,
  meta,
  trailing,
}: {
  href?: string;
  selected?: boolean;
  leading?: ReactNode;
  title: string;
  meta?: string;
  trailing?: ReactNode;
}) {
  const shell = selected
    ? "flex min-h-14 items-center gap-1 rounded-xl bg-surface px-2.5 py-2 shadow-[inset_3px_0_0_0_var(--primary)]"
    : "flex min-h-14 items-center gap-1 rounded-xl bg-surface px-2.5 py-2 hover:bg-surface-elevated";
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        {meta ? <span className="mt-0.5 block truncate text-[12px] text-muted">{meta}</span> : null}
      </span>
    </>
  );
  const main = "flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-hover";

  return (
    <div className={shell}>
      {href ? (
        <Link href={href} aria-current={selected ? "page" : undefined} className={main}>
          {body}
        </Link>
      ) : (
        <div className={main}>{body}</div>
      )}
      {trailing}
    </div>
  );
}
