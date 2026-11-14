"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";

const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const ITEM = 32;

export function MonthCalendar({
  showDates,
  selectedDate,
  onSelectDate,
  onClear,
  canClear = selectedDate != null,
}: {
  showDates: string[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
  onClear: () => void;
  canClear?: boolean;
}) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const todayKey = dateKey(currentYear, now.getUTCMonth(), now.getUTCDate());
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(now.getUTCMonth());
  const [open, setOpen] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const marked = new Set(showDates);
  const showMonths = new Set(showDates.map((value) => value.slice(0, 7)));
  const cells = monthCells(year, month);
  const years = [currentYear - 1, currentYear, currentYear + 1].map((value) => ({
    id: String(value),
    label: String(value),
  }));
  const months = monthNames.map((label, index) => ({
    id: String(index),
    label,
    marked: showMonths.has(`${year}-${String(index + 1).padStart(2, "0")}`),
  }));
  const monthHasShow = showMonths.has(`${year}-${String(month + 1).padStart(2, "0")}`);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: globalThis.PointerEvent) {
      if (!wheelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="mt-3 shrink-0 rounded-2xl bg-surface px-2.5 py-2.5">
      <div className="flex items-center gap-1">
        <div ref={wheelRef} className={`relative flex min-w-0 flex-1 ${open ? "h-24" : "h-8"}`}>
          {open ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 rounded-xl bg-background" />
              <Wheel label="Year" items={years} value={String(year)} onChange={(id) => setYear(Number(id))} className="w-16" />
              <Wheel label="Month" items={months} value={String(month)} onChange={(id) => setMonth(Number(id))} className="min-w-0 flex-1" />
            </>
          ) : (
            <button
              type="button"
              aria-expanded={false}
              aria-label={`${monthNames[month]} ${year}`}
              onClick={() => setOpen(true)}
              className="flex h-8 w-full items-center rounded-xl bg-background outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
            >
              <span className="w-16 text-center text-[13px] font-semibold text-ink">{year}</span>
              <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-[13px] font-semibold text-ink">
                <span className="truncate">{monthNames[month]}</span>
                {monthHasShow ? <span className="size-1.5 shrink-0 rounded-full bg-[#25c290]" /> : null}
              </span>
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Clear filter"
          disabled={!canClear}
          onClick={onClear}
          className={`grid size-7 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${
            canClear ? "text-ink hover:bg-background" : "cursor-default text-disabled"
          }`}
        >
          <RefreshIcon />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-semibold tracking-[0.14em] text-muted">
        {weekdays.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 place-items-center gap-y-1">
        {cells.map((day, index) => {
          if (day == null) return <span key={`empty-${index}`} className="size-7" />;
          const key = dateKey(year, month, day);
          return (
            <Day
              key={key}
              day={day}
              hasShow={marked.has(key)}
              selected={key === selectedDate}
              today={key === todayKey}
              onClick={() => onSelectDate(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function Wheel({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  items: { id: string; label: string; marked?: boolean }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; top: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const scrollingTo = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const valueRef = useRef(value);
  const itemsRef = useRef(items);
  const startIndex = useRef<number | null>(null);
  if (startIndex.current == null) startIndex.current = Math.max(0, items.findIndex((item) => item.id === value));
  const [active, setActive] = useState(startIndex.current);
  valueRef.current = value;
  itemsRef.current = items;

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || startIndex.current == null) return;
    node.scrollTop = startIndex.current * ITEM;
  }, []);

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const index = Math.max(0, itemsRef.current.findIndex((item) => item.id === value));
    const target = index * ITEM;
    if (Math.abs(node.scrollTop - target) <= 2) {
      scrollingTo.current = null;
      return;
    }
    scrollingTo.current = index;
    node.scrollTo({ top: target, behavior: "smooth" });
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function indexFromScroll() {
    const node = scroller.current;
    const max = itemsRef.current.length - 1;
    if (!node) return 0;
    return Math.min(max, Math.max(0, Math.round(node.scrollTop / ITEM)));
  }

  function commit(index: number) {
    if (scrollingTo.current != null && index !== scrollingTo.current) return;
    scrollingTo.current = null;
    setActive(index);
    const next = itemsRef.current[index]?.id;
    if (next && next !== valueRef.current) onChange(next);
  }

  function onScroll() {
    if (scrollingTo.current == null) setActive(indexFromScroll());
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(indexFromScroll()), 140);
  }

  function onScrollEnd() {
    if (timer.current) window.clearTimeout(timer.current);
    commit(indexFromScroll());
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const node = scroller.current;
    if (!node) return;
    scrollingTo.current = null;
    drag.current = { y: event.clientY, top: node.scrollTop, moved: false, id: event.pointerId };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const node = scroller.current;
    const current = drag.current;
    if (!node || !current || current.id !== event.pointerId) return;
    const delta = event.clientY - current.y;
    if (!current.moved && Math.abs(delta) <= 3) return;
    if (!current.moved) {
      current.moved = true;
      node.setPointerCapture(event.pointerId);
    }
    node.scrollTop = current.top - delta;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const node = scroller.current;
    const current = drag.current;
    drag.current = null;
    if (!node || !current || current.id !== event.pointerId) return;
    suppressClick.current = current.moved;
    if (current.moved) {
      node.releasePointerCapture(event.pointerId);
      const index = indexFromScroll();
      node.scrollTo({ top: index * ITEM, behavior: "smooth" });
    }
  }

  function pick(index: number) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    scrollingTo.current = index;
    setActive(index);
    const next = items[index]?.id;
    if (next && next !== valueRef.current) onChange(next);
    scroller.current?.scrollTo({ top: index * ITEM, behavior: "smooth" });
  }

  return (
    <div
      ref={scroller}
      role="listbox"
      aria-label={label}
      onScroll={onScroll}
      onScrollEnd={onScrollEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`relative z-10 h-24 snap-y snap-mandatory overflow-y-auto overscroll-y-contain [mask-image:linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
    >
      <div aria-hidden className="h-8" />
      {items.map((item, index) => {
        const distance = Math.abs(index - active);
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(index)}
            className={`flex h-8 w-full snap-center items-center justify-center gap-1.5 px-1 text-[13px] outline-none select-none focus-visible:ring-2 focus-visible:ring-primary-hover ${
              distance === 0 ? "font-semibold text-ink" : distance === 1 ? "text-muted" : "text-muted/45"
            }`}
          >
            <span className="truncate">{item.label}</span>
            {item.marked ? <span className="size-1.5 shrink-0 rounded-full bg-[#25c290]" /> : null}
          </button>
        );
      })}
      <div aria-hidden className="h-8" />
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M13.2 8A5.2 5.2 0 1 1 11.6 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M11.4 1.8v2.7H8.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Day({
  day,
  hasShow,
  selected,
  today,
  onClick,
}: {
  day: number;
  hasShow: boolean;
  selected: boolean;
  today: boolean;
  onClick: () => void;
}) {
  const face = hasShow
    ? "bg-[#25c290] text-[#06281c] shadow-[0_0_0_3px_rgb(37_194_144/0.22),0_6px_14px_rgb(37_194_144/0.28)]"
    : today
      ? "text-ink ring-1 ring-primary-hover"
      : "text-ink hover:bg-background";
  const picked = selected ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : "";

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={hasShow ? `${day}, has a show` : String(day)}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-full text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${face} ${picked}`}
    >
      {day}
    </button>
  );
}

function monthCells(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = Array.from({ length: start }, () => null);
  for (let day = 1; day <= count; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
