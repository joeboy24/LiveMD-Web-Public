import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyLabel } from "./components/empty-label";
import { listShows, listSongs } from "./shows/queries";
import { SongPanel } from "./shows/song-panel";

export default function Home({ searchParams }: { searchParams: Promise<{ show?: string | string[] }> }) {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading shows.</p>}>
      <ShowsWorkspace searchParams={searchParams} />
    </Suspense>
  );
}

async function ShowsWorkspace({ searchParams }: { searchParams: Promise<{ show?: string | string[] }> }) {
  await connection();
  const query = await searchParams;
  const requested = Array.isArray(query.show) ? query.show[0] : query.show;
  const shows = await listShows();
  const selected = shows.find((show) => show.id === requested) ?? null;
  const songs = selected ? await listSongs(selected.id) : [];

  if (!selected) return <EmptyLabel>Select a show.</EmptyLabel>;

  return <SongPanel showId={selected.id} title={selected.title} dateLabel={selected.dateLabel} songs={songs} />;
}
