import { connection } from "next/server";
import { publishedShowRows } from "../../../shows/queries";

export async function GET() {
  await connection();
  const shows = await publishedShowRows();
  return Response.json({ shows }, { headers: { "Cache-Control": "no-store" } });
}
