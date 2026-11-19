"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { FiChevronLeft } from "react-icons/fi";
import { IconRail } from "./icon-rail";
import { NotesPanel } from "./notes-panel";
import { chooseFeature, readPanel, readPanelServer, subscribePanel } from "./panel";
import type { TodoItem } from "../(main)/organization/queries";

export function Workspace({ shows, main, todos }: { shows: ReactNode; main: ReactNode; todos: TodoItem[] }) {
  const panel = useSyncExternalStore(subscribePanel, readPanel, readPanelServer);
  const feature = panel.feature;
  const pathname = usePathname();
  const showOpen = Boolean(useSearchParams().get("show"));
  const home = pathname === "/";
  const listOnly = home && !showOpen;

  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:[grid-template-columns:300px_minmax(0,3fr)_var(--notes-col)_3.25rem]"
      style={{ "--notes-col": feature === "checkout" ? "minmax(320px,24rem)" : feature ? "minmax(220px,1fr)" : "0px" } as CSSProperties}
    >
      <aside
        data-help="Shows for this organization. Pick one to arrange it or play it."
        className={`${listOnly ? "flex" : "hidden"} min-h-0 h-full w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto px-4 pt-4 md:flex md:overflow-hidden md:border-r md:border-surface-elevated md:px-3 md:py-4`}
      >
        {shows}
      </aside>
      <main
        data-help="The open show. Arrange the song, or play the setlist."
        className={`${listOnly ? "hidden" : "flex"} h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto px-4 py-4 md:flex md:overflow-hidden md:px-6`}
      >
        {home && showOpen ? (
          <Link href="/" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover md:hidden">
            <FiChevronLeft aria-hidden className="size-4" />
            Shows
          </Link>
        ) : null}
        {main}
      </main>
      {feature ? (
        <NotesPanel feature={feature} todos={todos} groupId={panel.groupId} group={panel.group} recipients={panel.recipients} support={panel.support} checkout={panel.checkout} />
      ) : (
        <div className="hidden md:block" />
      )}
      <IconRail feature={feature} onChoose={chooseFeature} />
    </div>
  );
}
