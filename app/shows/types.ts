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

export type SongSection = {
  name: string;
  bars: number;
  sourceIndex: number | null;
  sourceStartBar: number | null;
  sourceBars: number | null;
};

export type SongCue = {
  bar: number;
  text: string;
  place: number | null;
  y: number | null;
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
  stemKey: string | null;
  guideKey: string | null;
  trackKeys: string[];
  sections: SongSection[];
  cues: SongCue[];
  position: number;
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
