import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyLabel } from "../components/empty-label";
import { readAccess } from "../auth/access";
import { listShows, listSongs, showPublication } from "../shows/queries";
import { HistoryButtons } from "../shows/history";
import { PERFORMANCE_MODE_KEY, performanceModeFrom } from "../shows/performance-mode";
import { SongPanel } from "../shows/song-panel";

export default function Home({ searchParams }: { searchParams: Promise<{ show?: string | string[] }> }) {
  return (
    <Suspense fallback={<p className="text-base text-muted">Loading shows.</p>}>
      <ShowsWorkspace searchParams={searchParams} />
    </Suspense>
  );
}

async function ShowsWorkspace({ searchParams }: { searchParams: Promise<{ show?: string | string[] }> }) {
  await connection();
  const jar = await cookies();
  const rehearsal = performanceModeFrom(jar.get(PERFORMANCE_MODE_KEY)?.value);
  const query = await searchParams;
  const requested = Array.isArray(query.show) ? query.show[0] : query.show;
  const shows = await listShows();
  const selected = shows.find((show) => show.id === requested) ?? null;
  const songs = selected ? await listSongs(selected.id) : [];
  const publication = selected ? await showPublication(selected.id) : null;
  const access = await readAccess();

  if (!selected) {
    return (
      <>
        <HistoryButtons />
        <EmptyLabel>Select a show.</EmptyLabel>
      </>
    );
  }

  return (
    <SongPanel
      showId={selected.id}
      title={selected.title}
      dateLabel={selected.dateLabel}
      songs={songs}
      publication={publication}
      rehearsal={rehearsal}
      canEdit={access.prepare}
      canPlay={access.transport}
      canOpen={access.chart}
      canStage={access.stage}
    />
  );
}
