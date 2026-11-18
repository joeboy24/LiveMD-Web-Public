import { connection } from "next/server";
import { listGroups } from "../(main)/organization/queries";
import { listShows } from "./queries";
import { ShowBrowser } from "./show-browser";

export async function ShowSidebar() {
  await connection();
  const [shows, groups] = await Promise.all([listShows(), listGroups()]);
  return <ShowBrowser shows={shows} groups={groups} />;
}
