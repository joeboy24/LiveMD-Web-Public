"use client";

import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { IconRail } from "./icon-rail";
import { NotesPanel } from "./notes-panel";
import { chooseFeature, readPanel, readPanelServer, subscribePanel } from "./panel";
import type { TodoItem } from "../(main)/organization/queries";

export function Workspace({ shows, main, todos }: { shows: ReactNode; main: ReactNode; todos: TodoItem[] }) {
  const panel = useSyncExternalStore(subscribePanel, readPanel, readPanelServer);
  const feature = panel.feature;

  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:overflow-hidden md:[grid-template-columns:300px_minmax(0,3fr)_var(--notes-col)_3.25rem]"
      style={{ "--notes-col": feature ? "minmax(220px,1fr)" : "0px" } as CSSProperties}
    >
      <aside
        data-help="Shows for this organization. Pick one to arrange it or play it."
        className="flex min-h-0 w-full min-w-0 flex-col overflow-x-hidden px-4 pt-4 md:h-full md:overflow-hidden md:border-r md:border-surface-elevated md:px-3 md:py-4"
      >
        {shows}
      </aside>
      <main
        data-help="The open show. Arrange the song, or play the setlist."
        className="flex min-h-0 flex-col overflow-y-auto px-4 py-4 md:overflow-hidden md:px-6"
      >
        {main}
      </main>
      {feature ? <NotesPanel feature={feature} todos={todos} group={panel.group} recipients={panel.recipients} /> : <div className="hidden md:block" />}
      <IconRail feature={feature} onChoose={chooseFeature} />
    </div>
  );
}
