"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Modal({
  title,
  onClose,
  tone = "surface",
  children,
}: {
  title: string;
  onClose: () => void;
  tone?: "surface" | "background";
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
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[min(440px,calc(100vw-2rem))] overflow-auto rounded-2xl border-0 p-6 text-ink backdrop:bg-black/60 ${fill}`}
    >
      <h2 id={titleId} className="text-[22px] font-bold">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
