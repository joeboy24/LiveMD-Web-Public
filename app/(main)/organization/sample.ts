export const sampleSeats = [
  { name: "House lead", role: "Owner" },
  { name: "Music director", role: "Music director" },
  { name: "Playback", role: "Playback operator" },
  { name: "Keys", role: "Musician" },
] as const;

export const roles = [
  {
    name: "Owner",
    detail: "Names the organization, holds the plan, and can open every show.",
    audio: "Every layer",
    color: "#076FBF",
  },
  {
    name: "Music director",
    detail: "Prepares the arrangement, the cues, and the mix. Can open every show.",
    audio: "Every layer",
    color: "#25C290",
  },
  {
    name: "Musician",
    detail: "Prepares the show. This seat can't publish.",
    audio: "Every layer",
    color: "#FA8E23",
  },
  {
    name: "Playback operator",
    detail: "Plays the published show on the iPad. This seat doesn't use the website.",
    audio: "Click, stems, and guide",
    color: "#665A9C",
  },
] as const;

export const plans = [
  {
    name: "Personal",
    seats: 1,
    detail: "One seat for a person and their player.",
    sample: false,
  },
  {
    name: "House",
    seats: 50,
    detail: "Fifty seats for the organization.",
    sample: true,
  },
  {
    name: "Room",
    seats: 100,
    detail: "One hundred seats for the organization.",
    sample: false,
  },
  {
    name: "Custom",
    seats: 101,
    detail: "More than one hundred seats.",
    sample: false,
  },
] as const;

export function seatLimit(plan: string) {
  return plans.find((item) => item.name === plan)?.seats ?? 1;
}

export function termTotalCents(monthlyCents: number | null, term: "quarter" | "year") {
  if (monthlyCents == null) return null;
  return monthlyCents * (term === "quarter" ? 3 : 12);
}

export type OrderDiscount = {
  kind: "percent" | "amount";
  percent: number | null;
  amountCents: number | null;
};

export function orderCents(totalCents: number, discount: OrderDiscount | null) {
  if (!discount) return totalCents;
  const off =
    discount.kind === "percent" && discount.percent
      ? Math.round((totalCents * discount.percent) / 100)
      : discount.kind === "amount" && discount.amountCents
        ? discount.amountCents
        : 0;
  return Math.max(0, totalCents - Math.min(totalCents, off));
}

export function customPriceCents(roomCents: number | null, customSeats: number) {
  if (roomCents == null) return null;
  const roomSeats = seatLimit("Room");
  if (!(Number.isInteger(customSeats) && customSeats > roomSeats) || roomSeats < 1) return roomCents;
  return Math.round((customSeats * roomCents) / roomSeats);
}

export function storageGb(plan: string) {
  if (plan === "Custom") return 150;
  if (plan === "House" || plan === "Room") return 100;
  if (plan === "Personal") return 10;
  return null;
}

const planAccents: Record<string, string> = {
  Personal: "#076FBF",
  House: "#25C290",
  Room: "#FA8E23",
  Custom: "#6A4CFF",
};

export function planAccent(plan: string) {
  return planAccents[plan] ?? "#076FBF";
}
