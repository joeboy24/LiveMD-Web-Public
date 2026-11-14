export type Show = {
  id: string;
  title: string;
  songCount: number;
  month: string;
  day: string;
  dateLabel: string;
  dateKey: string;
  ipadUpdate: boolean;
};

export type Song = {
  id: string;
  title: string;
  tempo: number;
  beatsPerBar: number;
  key: string | null;
  leadBeats: number;
  slipBars: number;
  lyrics: string;
};

export type ShowSnapshot = {
  id: string;
  title: string;
  performedOn: string;
  songs: Array<Song & { createdAt: string }>;
};

export type FormState = {
  error: string | null;
  saved?: boolean;
  song?: Song;
  show?: ShowSnapshot;
};
