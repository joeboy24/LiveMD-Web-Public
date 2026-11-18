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
] as const;

export function seatLimit(plan: string) {
  return plans.find((item) => item.name === plan)?.seats ?? 1;
}
