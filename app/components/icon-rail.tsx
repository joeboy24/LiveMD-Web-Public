import { FiBell, FiCheckSquare, FiHelpCircle, FiMessageSquare } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";

const tools = [
  { label: "Help", icon: FiHelpCircle },
  { label: "Notifications", icon: FiBell, dot: true },
  { label: "Tasks", icon: FiCheckSquare },
  { label: "Chat", icon: FiMessageSquare },
  { label: "Sparkles", icon: LuSparkles },
] as const;

export function IconRail() {
  return (
    <aside aria-label="Tools" className="hidden h-full min-h-0 flex-col justify-end border-l border-surface-elevated py-3 md:flex">
      <div className="grid justify-items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            aria-label={tool.label}
            className="relative grid size-10 place-items-center rounded-xl text-muted outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <tool.icon aria-hidden className="size-[18px]" />
            {"dot" in tool ? <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[#e85d4c]" /> : null}
          </button>
        ))}
      </div>
    </aside>
  );
}
