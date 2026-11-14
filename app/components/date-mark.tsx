export function DateMark({ month, day }: { month: string; day: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-background leading-none">
      <span className="text-[9px] font-semibold tracking-wide text-muted">{month}</span>
      <span className="mt-0.5 text-[14px] font-bold text-ink">{day}</span>
    </span>
  );
}
