"use client";

import { useEffect } from "react";
import { playChime, SupportChat } from "../../components/support-watch";

export default function SupportPreview() {
  useEffect(() => {
    let heard = false;
    const hear = () => {
      if (heard) return;
      void playChime().then((ok) => {
        heard = ok;
      });
    };
    hear();
    window.addEventListener("pointerdown", hear);
    return () => window.removeEventListener("pointerdown", hear);
  }, []);

  return (
    <main className="min-h-dvh bg-background">
      <header className="relative z-[60] border-b border-surface-elevated bg-surface">
        <div className="flex items-center gap-5 px-4 py-3.5">
          <span className="text-lg font-bold tracking-tight text-ink">
            Live<span className="pl-0.5 text-primary-hover">MD</span>
          </span>
          <nav className="flex items-center gap-0.5 rounded-full bg-background p-0.5 ring-1 ring-surface-elevated" aria-label="Site">
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold text-muted">Shows</span>
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold text-muted">Organization</span>
            <span className="rounded-full bg-primary px-3 py-1 text-[13px] font-semibold text-white">System</span>
          </nav>
        </div>
      </header>
      <p className="px-6 pt-16 text-[13px] text-muted">Sample of the support alert. It stays on screen here.</p>
      <SupportChat line="UNIXN.ORG · Joseph OG · Owner" text="I'd like to downgrade my subscription." />
    </main>
  );
}
