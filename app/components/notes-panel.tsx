"use client";

import { useEffect, useSyncExternalStore } from "react";
import { FiMessageSquare, FiX } from "react-icons/fi";
import { CheckoutSheet } from "./checkout-sheet";
import { MessageSheet } from "./message-sheet";
import { NotificationSheet } from "./notification-sheet";
import { chooseFeature, openSupport, type CheckoutDraft, type MessageSeat, type SideFeature } from "./panel";
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
  support,
  checkout,
}: {
  feature: SideFeature;
  todos: TodoItem[];
  groupId: string | null;
  group: string | null;
  recipients: MessageSeat[];
  support: boolean;
  checkout: CheckoutDraft | null;
}) {
  return (
    <aside data-notes="" className="fixed inset-0 z-30 overflow-y-auto bg-background md:static md:z-auto md:h-full md:min-h-0 md:overflow-y-auto md:bg-transparent">
      <div className="m-3 overflow-hidden rounded-2xl bg-surface shadow-[0_18px_40px_rgb(0_0_0/0.18)] ring-1 ring-white/10">
        <div className="h-1 bg-[linear-gradient(90deg,#25C290,#38A7E2,#FA8E23)]" />
        {feature === "checkout" ? null : <div className="flex items-center justify-between gap-2 px-3 pt-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted">
            <button
              type="button"
              aria-label="Close"
              onClick={() => chooseFeature(feature)}
              className="grid size-7 place-items-center rounded-full text-ink outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-primary-hover md:hidden"
            >
              <FiX aria-hidden className="size-4" />
            </button>
            NOTES
          </p>
          <button
            type="button"
            onClick={openSupport}
            aria-pressed={support}
            data-help="Open a note to support. It emails the system admins and leaves them an alert. Excessive use of this feature may result in your account being disabled."
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${support ? "bg-primary text-white" : "bg-background text-ink hover:text-primary-hover"}`}
          >
            <FiMessageSquare aria-hidden className="size-3" />
            Contact support
          </button>
        </div>}
        {feature === "checkout" ? null : <HelpNote />}
        {feature === "tasks" ? <TodoList initial={todos} /> : null}
        {feature === "message" ? <MessageSheet groupId={groupId} group={group} recipients={recipients} support={support} /> : null}
        {feature === "notifications" ? <NotificationSheet /> : null}
        {feature === "checkout" && checkout ? <CheckoutSheet key={checkout.plan} draft={checkout} /> : null}
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
