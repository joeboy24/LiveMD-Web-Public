import { connection } from "next/server";
import { keepsAudio, readAccess } from "../../../../auth/access";
import { showPublication } from "../../../../shows/queries";
import { offlinePackage } from "../../../../shows/publication";
import { signAudioRead } from "../../../../shows/storage";

export async function GET(_request: Request, context: { params: Promise<{ showId: string }> }) {
  await connection();
  const { showId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(showId)) return new Response(null, { status: 404 });

  const show = await showPublication(showId);
  if (!show) return new Response(null, { status: 404 });
  const pack = offlinePackage(show.songs);
  if (!pack) return new Response(null, { status: 500 });
  if (pack.songs.length === 0) return new Response(null, { status: 404 });
  const access = await readAccess();
  const visible = pack.files.filter((file) => keepsAudio(file.name, pack.songs, access.layers));

  const files = await Promise.all(
    visible.map(async (file) => {
      const signed = await signAudioRead(showId, file.key);
      if (!("url" in signed) || !signed.url) return null;
      const name = file.name.startsWith("audio/") ? file.name.slice("audio/".length) : file.name;
      return { name, url: signed.url };
    }),
  );
  if (files.some((file) => file === null)) return new Response(null, { status: 500 });

  return Response.json(
    {
      id: show.id,
      title: show.title,
      performedOn: show.performedOn,
      publishedAt: show.publishedAt,
      songs: pack.songs,
      files,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
