"use client";

import { useEffect, useSyncExternalStore } from "react";
import { FiBell, FiCheckSquare, FiHelpCircle, FiMessageSquare } from "react-icons/fi";
import type { IconType } from "react-icons";
import { unreadNotifications } from "../(main)/organization/notification-actions";
import { readNoticeCount, setNoticeCount, subscribeNoticeCount } from "./notice-count";
import type { SideFeature } from "./panel";

export type { SideFeature };

const tools: { id: SideFeature | null; label: string; help: string; icon: IconType; dot?: boolean }[] = [
  { id: "notifications", label: "Notifications", help: "Open alerts for your seat.", icon: FiBell, dot: true },
  { id: "tasks", label: "Tasks", help: "Open the to-do list.", icon: FiCheckSquare },
  { id: "message", label: "Chat", help: "Open a message and choose the seats that receive it.", icon: FiMessageSquare },
  { id: "help", label: "Help", help: "Open notes for the control under the pointer.", icon: FiHelpCircle },
];

export function IconRail({ feature, onChoose }: { feature: SideFeature | null; onChoose: (feature: SideFeature) => void }) {
  const mark = useSyncExternalStore(subscribeNoticeCount, readNoticeCount, () => "none" as const);

  useEffect(() => {
    let live = true;
    unreadNotifications().then((next) => {
      if (live) setNoticeCount(next);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <aside aria-label="Tools" className="hidden h-full min-h-0 flex-col justify-end border-l border-surface-elevated py-3 md:flex">
      <div className="grid justify-items-center gap-1">
        {tools.map((tool) => {
          const selected = tool.id !== null && feature === tool.id;
          return (
            <button
              key={tool.label}
              type="button"
              aria-label={tool.label}
              aria-pressed={selected}
              data-help={tool.help}
              onClick={() => {
                if (tool.id) onChoose(tool.id);
              }}
              className={`relative grid size-10 place-items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${selected ? "bg-primary text-white" : "text-muted hover:bg-surface hover:text-ink"}`}
            >
              <tool.icon aria-hidden className="size-[18px]" />
              {tool.dot && mark !== "none" ? (
                <span className={`absolute top-2 right-2 size-1.5 rounded-full ${mark === "system" ? "bg-[#e85d4c]" : "bg-[#25C290]"}`} />
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
