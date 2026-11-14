import { connection } from "next/server";
import { listShows } from "./queries";
import { ShowBrowser } from "./show-browser";

export async function ShowSidebar() {
  await connection();
  const shows = await listShows();
  return <ShowBrowser shows={shows} />;
}
