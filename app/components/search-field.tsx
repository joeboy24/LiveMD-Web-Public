export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3">
      <span className="sr-only">{label}</span>
      <SearchIcon />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
      />
    </label>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-muted">
      <path
        fill="currentColor"
        d="M7 1.5a5.5 5.5 0 0 1 4.38 8.82l2.9 2.9-1.06 1.06-2.9-2.9A5.5 5.5 0 1 1 7 1.5Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
      />
    </svg>
  );
}
