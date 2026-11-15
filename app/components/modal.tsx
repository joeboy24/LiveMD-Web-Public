"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Modal({
  title,
  onClose,
  tone = "surface",
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  tone?: "surface" | "background";
  wide?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const fill = tone === "background" ? "bg-background" : "bg-surface";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) dialog?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className={`relative m-auto max-h-[calc(100dvh-2rem)] ${wide ? "w-[min(640px,calc(100vw-2rem))]" : "w-[min(440px,calc(100vw-2rem))]"} overflow-auto rounded-2xl border-0 p-6 text-ink backdrop:bg-black/60 ${fill}`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => dialogRef.current?.close()}
        className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-muted outline-none hover:bg-background hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
      >
        <span aria-hidden="true" className="text-[18px] leading-none">
          ×
        </span>
      </button>
      <h2 id={titleId} className="pr-10 text-[22px] font-bold">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
