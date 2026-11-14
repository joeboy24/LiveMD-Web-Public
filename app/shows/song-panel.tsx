import { songCountLabel } from "./format";
import { SongList } from "./song-list";
import type { Song } from "./types";

export function SongPanel({
  showId,
  title,
  dateLabel,
  songs,
}: {
  showId: string;
  title: string;
  dateLabel: string;
  songs: Song[];
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[22px] font-bold text-ink">{title}</h2>
        <p className="text-[13px] text-muted">{dateLabel}</p>
      </div>
      <p className="mt-1 text-[14px] text-muted">{songCountLabel(songs.length)}</p>
      <SongList showId={showId} songs={songs} />
    </section>
  );
}
