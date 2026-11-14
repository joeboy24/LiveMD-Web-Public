export type Show = {
  id: string;
  title: string;
  songCount: number;
  month: string;
  day: string;
  dateLabel: string;
  dateKey: string;
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

export type FormState = {
  error: string | null;
  saved?: boolean;
};
