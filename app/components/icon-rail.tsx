"use client";

import { FiBell, FiCheckSquare, FiHelpCircle, FiMessageSquare } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import type { IconType } from "react-icons";
import type { SideFeature } from "./panel";

export type { SideFeature };

const tools: { id: SideFeature | null; label: string; help: string; icon: IconType; dot?: boolean }[] = [
  { id: "help", label: "Help", help: "Open notes for the control under the pointer.", icon: FiHelpCircle },
  { id: null, label: "Notifications", help: "Alerts for this organization.", icon: FiBell, dot: true },
  { id: "tasks", label: "Tasks", help: "Open the to-do list.", icon: FiCheckSquare },
  { id: "message", label: "Chat", help: "Open a message and choose the seats that receive it.", icon: FiMessageSquare },
  { id: null, label: "Sparkles", help: "Suggestions for the arrangement.", icon: LuSparkles },
];

export function IconRail({ feature, onChoose }: { feature: SideFeature | null; onChoose: (feature: SideFeature) => void }) {
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
              {tool.dot ? <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#e85d4c]" /> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
