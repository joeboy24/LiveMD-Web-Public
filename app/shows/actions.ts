"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "../db";
import type { FormState } from "./types";

export async function createShow(_state: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Enter a show name." };

  const sql = getSql();
  const rows = await sql`insert into shows (title) values (${title}) returning id`;
  redirect(`/?show=${rows[0].id}`);
}

export async function createSong(showId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const lyrics = String(formData.get("lyrics") ?? "");
  const tempo = numberValue(formData.get("tempo"));
  const beatsPerBar = numberValue(formData.get("beatsPerBar")) ?? 4;
  const leadBeats = optionalNumber(formData.get("leadBeats"));
  const slipBars = optionalNumber(formData.get("slipBars"));

  if (!title) return { error: "A song needs a title." };
  if (tempo == null || tempo <= 0) return { error: "Tempo has to be greater than zero." };
  if (!Number.isInteger(beatsPerBar) || beatsPerBar < 1) {
    return { error: "Beats per bar has to be a whole number." };
  }
  if (leadBeats == null || leadBeats < 0) return { error: "Lead beats cannot be negative." };
  if (slipBars == null || !Number.isInteger(slipBars) || slipBars < 0) {
    return { error: "Slip has to be a whole number of bars." };
  }

  const sql = getSql();
  await sql`
    insert into songs (show_id, title, tempo, beats_per_bar, key, lead_beats, slip_bars, lyrics)
    values (
      ${showId},
      ${title},
      ${tempo},
      ${beatsPerBar},
      ${key || null},
      ${leadBeats},
      ${slipBars},
      ${lyrics}
    )
  `;
  revalidatePath("/", "layout");
  return { error: null, saved: true };
}

export async function deleteSong(songId: string) {
  const sql = getSql();
  await sql`delete from songs where id = ${songId}`;
  revalidatePath("/", "layout");
}

function numberValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return 0;
  return numberValue(value);
}
