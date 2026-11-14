export function ImportRow({
  label,
  empty,
  fileName,
  onFile,
}: {
  label: string;
  empty: string;
  fileName: string;
  onFile: (file: File | null) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface px-3.5 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-muted">{label}</span>
        <span className="block truncate text-[16px] font-semibold text-ink">{fileName || empty}</span>
      </span>
      <DownloadIcon />
      <input
        type="file"
        accept="audio/*"
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0 text-primary">
      <path
        fill="currentColor"
        d="M9 2.2a.9.9 0 0 1 .9.9v6.1l1.8-1.8 1.3 1.3L9 12.7 4.9 8.7l1.3-1.3 1.8 1.8V3.1A.9.9 0 0 1 9 2.2ZM4 13.2h10v1.6H4z"
      />
    </svg>
  );
}
