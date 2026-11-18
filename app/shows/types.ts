export type Show = {
  id: string;
  title: string;
  songCount: number;
  month: string;
  day: string;
  dateLabel: string;
  dateKey: string;
  published: boolean;
  audienceRoles: string[];
  audienceGroupIds: string[];
};

export type PublishedSong = {
  id: string;
  title: string;
  tempo: number;
  beatsPerBar: number;
  key: string | null;
  leadBeats: number;
  slipBars: number;
  lyrics: string;
  sections: SongSection[];
  cues: SongCue[];
  stemKey: string | null;
  guideKey: string | null;
  trackKeys: string[];
  mix: SongMix;
  stage: SongStage;
  position: number;
};

export type PublishedShow = {
  id: string;
  title: string;
  performedOn: string;
  publishedAt: string;
  songs: PublishedSong[];
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

export type MixChannel = {
  level: number;
  muted: boolean;
  solo: boolean;
};

export type SongMix = {
  stems: MixChannel;
  click: MixChannel;
  cues: MixChannel;
  layers: Record<string, MixChannel>;
};

export type SongRoute = {
  click: number;
  stems: number;
  guide: number;
};

export type SongStage = {
  pitch: number;
  route: SongRoute;
  applyStem: boolean;
  sourceTempo: number | null;
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
  mix: SongMix;
  stage: SongStage;
  position: number;
};

export type ShowSnapshot = {
  id: string;
  title: string;
  performedOn: string;
  publishedAt: string | null;
  publishedSongs: PublishedSong[] | null;
  songs: Array<Song & { createdAt: string }>;
};

export type FormState = {
  error: string | null;
  saved?: boolean;
  song?: Song;
  show?: ShowSnapshot;
};
