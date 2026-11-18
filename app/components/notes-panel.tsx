"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MessageSheet } from "./message-sheet";
import { NotificationSheet } from "./notification-sheet";
import type { MessageSeat, SideFeature } from "./panel";
import { TodoList } from "./todo-list";
import type { TodoItem } from "../(main)/organization/queries";

let help = "";
const listeners = new Set<() => void>();

function setHelp(next: string) {
  if (next === help) return;
  help = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function NotesPanel({
  feature,
  todos,
  groupId,
  group,
  recipients,
}: {
  feature: SideFeature;
  todos: TodoItem[];
  groupId: string | null;
  group: string | null;
  recipients: MessageSeat[];
}) {
  return (
    <aside data-notes="" className="hidden h-full min-h-0 overflow-y-auto md:block">
      <div className="m-3 overflow-hidden rounded-2xl bg-surface shadow-[0_18px_40px_rgb(0_0_0/0.18)] ring-1 ring-white/10">
        <div className="h-1 bg-[linear-gradient(90deg,#25C290,#38A7E2,#FA8E23)]" />
        <p className="px-3 pt-3 text-[11px] font-semibold tracking-[0.16em] text-muted">NOTES</p>
        <HelpNote />
        {feature === "tasks" ? <TodoList initial={todos} /> : null}
        {feature === "message" ? <MessageSheet groupId={groupId} group={group} recipients={recipients} /> : null}
        {feature === "notifications" ? <NotificationSheet /> : null}
      </div>
    </aside>
  );
}

function HelpNote() {
  const text = useSyncExternalStore(subscribe, () => help, () => "");

  useEffect(() => {
    function onOver(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element) || target.closest("[data-help-display]")) return;
      const node = target.closest("[data-help],[aria-label]");
      setHelp(node?.getAttribute("data-help") || node?.getAttribute("aria-label") || "");
    }
    document.addEventListener("pointerover", onOver);
    return () => {
      document.removeEventListener("pointerover", onOver);
      setHelp("");
    };
  }, []);

  return (
    <p data-help-display="" className={`mx-3 my-3 shrink-0 rounded-xl bg-background/80 px-3 py-2.5 text-[13px] leading-5 ${text ? "text-ink" : "text-muted"}`}>
      {text || "Hover a control to see what it does."}
    </p>
  );
}
