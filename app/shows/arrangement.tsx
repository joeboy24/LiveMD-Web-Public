"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RowMenu } from "../components/row-menu";
import { readAudio, saveArrangement } from "./actions";
import { THEME_EVENT } from "../theme";
import { barLabel, cueColor, encodeSectionLyrics, lyricBlocks, moreSectionNames, sectionAtBar, sectionColor, sectionNames } from "./structure";
import type { Song, SongCue, SongSection } from "./types";

const barWidth = 32;
const rulerHeight = 28;
const laneHeight = 132;
const headerHeight = 24;

type EditSection = SongSection & { id: string };
type Segment = "tracks" | "sections" | "cues";
type Snap = { sections: EditSection[]; cues: SongCue[]; leadBeats: number; slipBars: number; lyrics: string };

export function Arrangement({
  showId,
  song,
  songs,
  onClose,
  onOpen,
}: {
  showId: string;
  song: Song;
  songs: Song[];
  onClose: () => void;
  onOpen: (songId: string) => void;
}) {
  const [segment, setSegment] = useState<Segment>("tracks");
  const [sections, setSections] = useState<EditSection[]>(() => withIds(song.sections));
  const [cues, setCues] = useState<SongCue[]>(song.cues);
  const [leadBeats, setLeadBeats] = useState(song.leadBeats);
  const [slipBars, setSlipBars] = useState(song.slipBars);
  const [lyrics, setLyrics] = useState(song.lyrics);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [draftLines, setDraftLines] = useState<string[]>([]);
  const [sectionName, setSectionName] = useState("Verse");
  const [cueText, setCueText] = useState("");
  const [selectedBar, setSelectedBar] = useState(1);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [rehearsal, setRehearsal] = useState(false);
  const [ready, setReady] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [status, setStatus] = useState<string | null>(song.stemKey ? "Reading the track…" : null);
  const [error, setError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoRef = useRef<Snap[]>([]);
  const redoRef = useRef<Snap[]>([]);
  const sectionsRef = useRef(sections);
  const cuesRef = useRef(cues);
  const leadRef = useRef(leadBeats);
  const slipRef = useRef(slipBars);
  const lyricsRef = useRef(lyrics);
  const playheadRef = useRef(0);
  const totalRef = useRef(1);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playRef = useRef<{ contextTime: number; chart: number } | null>(null);
  const playingRef = useRef(false);
  const loopRange = useRef<{ start: number; end: number } | null>(null);
  const tokenRef = useRef(0);
  const rafRef = useRef(0);
  const seeded = useRef(song.sections.length > 0);
  sectionsRef.current = sections;
  cuesRef.current = cues;
  leadRef.current = leadBeats;
  slipRef.current = slipBars;
  lyricsRef.current = lyrics;

  const totalBars = Math.max(sections.reduce((sum, section) => sum + section.bars, 0), 1);
  totalRef.current = totalBars;
  const canStart = splitAt(sections, Math.min(selectedBar, totalBars), sectionName.trim() || "Verse") !== null;

  useEffect(() => {
    if (!song.stemKey) return;
    const controller = new AbortController();
    let alive = true;
    readAudio(showId, song.stemKey)
      .then(async (signed) => {
        if (!alive) return;
        if ("error" in signed) {
          setStatus(signed.error ?? "The track didn't load.");
          return;
        }
        const response = await fetch(signed.url, { signal: controller.signal });
        if (!response.ok) throw new Error("load");
        const context = new AudioContext();
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        await context.close();
        if (!alive) return;
        const barDuration = (Math.max(song.beatsPerBar, 1) * 60) / Math.max(song.tempo, 1);
        const bars = Math.max(1, Math.round(buffer.duration / barDuration));
        bufferRef.current = buffer;
        setReady(true);
        setPeaks(peaksFrom(buffer, bars * 8));
        setStatus(null);
        if (!seeded.current && sectionsRef.current.length === 0) {
          seeded.current = true;
          const seededSections = [freshSection("Song", bars)];
          setSections(seededSections);
          void persist(showId, song.id, seededSections, cuesRef.current, leadRef.current, slipRef.current, lyricsRef.current, setError);
        }
      })
      .catch((reason: unknown) => {
        if (!alive || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setStatus("The track didn't load.");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [showId, song.id, song.stemKey, song.beatsPerBar, song.tempo]);

  function snapshot(): Snap {
    return {
      sections: sectionsRef.current,
      cues: cuesRef.current,
      leadBeats: leadRef.current,
      slipBars: slipRef.current,
      lyrics: lyricsRef.current,
    };
  }

  function remember() {
    undoRef.current.push(snapshot());
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function apply(
    nextSections: EditSection[],
    nextCues: SongCue[],
    record = true,
    nextLead = leadRef.current,
    nextSlip = slipRef.current,
    nextLyrics = lyricsRef.current,
  ) {
    if (record) remember();
    sectionsRef.current = nextSections;
    cuesRef.current = nextCues;
    leadRef.current = nextLead;
    slipRef.current = nextSlip;
    lyricsRef.current = nextLyrics;
    setSections(nextSections);
    setCues(nextCues);
    setLeadBeats(nextLead);
    setSlipBars(nextSlip);
    setLyrics(nextLyrics);
    void persist(showId, song.id, nextSections, nextCues, nextLead, nextSlip, nextLyrics, setError);
  }

  function undo() {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current.push(snapshot());
    apply(previous.sections, previous.cues, false, previous.leadBeats, previous.slipBars, previous.lyrics);
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(true);
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(snapshot());
    apply(next.sections, next.cues, false, next.leadBeats, next.slipBars, next.lyrics);
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
  }

  function startSection() {
    const next = splitAt(sections, Math.min(selectedBar, totalBars), sectionName.trim() || "Verse");
    if (next) apply(next, cues);
  }

  function addCue() {
    const text = cueText.trim();
    if (!text) return;
    const bar = Math.min(Math.max(selectedBar, 1), totalBars);
    const next = [...cues, { bar, text, place: bar - 1, y: 0.5 }].sort(
      (left, right) => (left.place ?? left.bar) - (right.place ?? right.bar),
    );
    setCueText("");
    apply(sections, next);
  }

  function nudge(delta: number) {
    if (sectionsRef.current.length === 0) return;
    const beats = Math.max(song.beatsPerBar, 1);
    const span = beats * 8;
    const nextLead = Math.min(Math.max(Math.round((leadRef.current + delta) * 10) / 10, -span), span);
    if (Math.abs(nextLead - leadRef.current) < 0.001) return;
    const padding = nextLead > 0 ? Math.ceil(nextLead / beats) : 0;
    const deltaBars = padding - slipRef.current;
    let nextSections = sectionsRef.current;
    if (deltaBars !== 0 && nextSections.length > 0) {
      const last = nextSections[nextSections.length - 1];
      const bars = Math.max(1, last.bars + deltaBars);
      const applied = bars - last.bars;
      let sourceBars = last.sourceBars ?? last.bars;
      if (applied > 0) sourceBars += applied;
      else if (applied < 0 && sourceBars >= last.bars) sourceBars = Math.max(1, sourceBars + applied);
      else if (sourceBars > bars) sourceBars = bars;
      nextSections = nextSections.slice();
      nextSections[nextSections.length - 1] = { ...last, bars, sourceBars };
    }
    apply(nextSections, cuesRef.current, true, nextLead, padding, lyricsRef.current);
  }

  function moveEdge(index: number, toBar: number) {
    const next = shiftEdge(sectionsRef.current, index, toBar);
    if (next) apply(next, cuesRef.current);
  }

  function reset() {
    const bars = Math.max(totalBars - slipRef.current, 1);
    apply([freshSection("Song", bars)], cues, true, 0, 0, lyricsRef.current);
  }

  function beginLyrics() {
    setDraftLines(lyricBlocks(lyricsRef.current, stored(sectionsRef.current)).map((block) => block.lines.join("\n")));
    setEditingLyrics(true);
  }

  function finishLyrics() {
    const blocks = stored(sectionsRef.current).map((section, index) => ({
      name: section.name,
      lines: (draftLines[index] ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
    }));
    const encoded = blocks.some((block) => block.lines.length) ? encodeSectionLyrics(blocks) : "";
    setEditingLyrics(false);
    apply(sectionsRef.current, cuesRef.current, true, leadRef.current, slipRef.current, encoded);
  }

  function barSeconds() {
    return (Math.max(song.beatsPerBar, 1) * 60) / Math.max(song.tempo, 1);
  }

  function spanAt(chart: number) {
    let start = 0;
    for (const section of sectionsRef.current) {
      const end = start + section.bars;
      if (chart < end - 0.0001) return { start, end };
      start = end;
    }
    return { start: 0, end: totalRef.current };
  }

  function placeHead(chart: number, resume: boolean) {
    const next = Math.min(Math.max(chart, 0), Math.max(totalRef.current - 0.0001, 0));
    playheadRef.current = next;
    setPlayhead(next);
    setSelectedBar(Math.min(totalRef.current, Math.max(1, Math.floor(next) + 1)));
    if (playingRef.current && resume) {
      startAt(next);
      return;
    }
    if (loopRange.current) loopRange.current = spanAt(next);
  }

  function halt() {
    tokenRef.current += 1;
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    playRef.current = null;
    const source = sourceRef.current;
    sourceRef.current = null;
    try {
      source?.stop();
    } catch {
      // The source already finished.
    }
  }

  function follow() {
    const anchor = playRef.current;
    const context = audioRef.current;
    if (!anchor || !context || !playingRef.current) return;
    const chart = anchor.chart + (context.currentTime - anchor.contextTime) / barSeconds();
    const loop = loopRange.current;
    if (loop && chart >= loop.end - 0.015) {
      startAt(loop.start);
      return;
    }
    if (chart >= totalRef.current - 0.001) {
      halt();
      placeHead(Math.max(totalRef.current - 0.0001, 0), false);
      return;
    }
    playheadRef.current = chart;
    setPlayhead(chart);
    setSelectedBar(Math.min(totalRef.current, Math.max(1, Math.floor(chart) + 1)));
    rafRef.current = requestAnimationFrame(follow);
  }

  function startAt(chart: number) {
    const buffer = bufferRef.current;
    if (!buffer) return;
    const context = audioRef.current ?? new AudioContext();
    audioRef.current = context;
    void context.resume();
    tokenRef.current += 1;
    const token = tokenRef.current;
    try {
      sourceRef.current?.stop();
    } catch {
      // The previous source already finished.
    }
    const beats = Math.max(song.beatsPerBar, 1);
    const seconds = ((chart * beats - leadRef.current) * 60) / Math.max(song.tempo, 1);
    const delay = Math.max(0, -seconds);
    const offset = Math.min(Math.max(seconds, 0), Math.max(buffer.duration - 0.02, 0));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      if (tokenRef.current !== token || !playingRef.current) return;
      halt();
      placeHead(Math.max(totalRef.current - 0.0001, 0), false);
    };
    if (buffer.duration - offset > 0.02) source.start(context.currentTime + delay, offset);
    sourceRef.current = source;
    playRef.current = { contextTime: context.currentTime, chart };
    playingRef.current = true;
    setPlaying(true);
    playheadRef.current = chart;
    setPlayhead(chart);
    setSelectedBar(Math.min(totalRef.current, Math.max(1, Math.floor(chart) + 1)));
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(follow);
  }

  function togglePlay() {
    if (!bufferRef.current) return;
    if (playingRef.current) halt();
    else startAt(playheadRef.current);
  }

  function stop() {
    halt();
    placeHead(0, false);
  }

  function toggleLoop() {
    setLooping((on) => {
      const next = !on;
      loopRange.current = next ? spanAt(playheadRef.current) : null;
      return next;
    });
  }

  function chooseBar(bar: number) {
    placeHead(bar - 1, true);
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      try {
        sourceRef.current?.stop();
      } catch {
        // The source already finished.
      }
      void audioRef.current?.close();
    };
  }, []);

  const shownBar = Math.min(totalBars, Math.max(1, Math.floor(Math.min(playhead, totalBars - 0.0001)) + 1));
  const shownSection = sectionAtBar(stored(sections), shownBar);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2">
        <button
          type="button"
          aria-label="Setlist"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-lg text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          <Chevron />
        </button>
        <h2 className="truncate text-center text-[17px] font-semibold text-ink">{song.title}</h2>
        <div className="flex items-center">
          <IconButton label="Undo" disabled={!canUndo} onClick={undo}>
            <UndoIcon />
          </IconButton>
          <IconButton label="Redo" disabled={!canRedo} onClick={redo}>
            <RedoIcon />
          </IconButton>
          <RowMenu label="Arrangement actions" items={[{ label: "Reset", onSelect: reset }]} />
        </div>
      </div>

      <div className="mt-3 flex shrink-0 items-center gap-3">
        <p className="min-w-0 truncate">
          <span className="text-[22px] font-semibold text-ink tabular-nums">{shownBar}</span>
          <span className="ml-2 text-[13px] font-medium text-muted">
            of {totalBars} · {shownSection}
          </span>
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <label className="relative block max-w-[200px]">
            <select
              aria-label="Setlist songs"
              value={song.id}
              onChange={(event) => onOpen(event.target.value)}
              className="h-8 w-full appearance-none truncate rounded-[10px] bg-surface pr-7 pl-2.5 text-[13px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
            >
              {songs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-bold text-ink">⌄</span>
          </label>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            disabled={!ready}
            onClick={togglePlay}
            className="grid size-8 place-items-center rounded-full bg-primary text-white outline-none focus-visible:ring-2 focus-visible:ring-primary-hover disabled:opacity-40"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            aria-label="Stop and return to the beginning"
            onClick={stop}
            className="grid size-8 place-items-center rounded-[10px] bg-surface text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <StopIcon />
          </button>
          <button
            type="button"
            aria-label={looping ? "Stop looping this section" : "Loop this section"}
            aria-pressed={looping}
            onClick={toggleLoop}
            className={`grid size-8 place-items-center rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${looping ? "bg-primary text-white" : "bg-surface text-muted"}`}
          >
            <RepeatIcon />
          </button>
          <button
            type="button"
            onClick={() => setRehearsal((on) => !on)}
            className={`h-8 rounded-[10px] px-2.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${rehearsal ? "bg-primary text-white" : "bg-surface text-ink"}`}
          >
            {rehearsal ? "Production Mode" : "Rehearsal Mode"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid shrink-0 grid-cols-3 gap-2">
        {(["tracks", "sections", "cues"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSegment(item)}
            className={
              segment === item
                ? "h-8 rounded-[10px] bg-primary text-[13px] font-semibold text-white"
                : "h-8 rounded-[10px] bg-surface text-[13px] font-semibold text-muted"
            }
          >
            {item === "tracks" ? "Tracks" : item === "sections" ? "Sections" : "Cues"}
          </button>
        ))}
      </div>

      {segment === "tracks" ? (
        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          {song.stemKey ? (
            <>
              <Wave
                sections={sections}
                cues={cues}
                totalBars={totalBars}
                peaks={peaks}
                beatsPerBar={Math.max(song.beatsPerBar, 1)}
                leadBeats={leadBeats}
                playhead={Math.min(playhead, totalBars - 0.0001)}
                selectedBar={shownBar}
                onSelect={chooseBar}
                onMoveEdge={moveEdge}
              />
              <div className="mt-3 shrink-0 rounded-xl bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-8 overflow-hidden rounded-[10px] bg-background">
                    <input
                      aria-label="Section name"
                      value={sectionName}
                      onChange={(event) => setSectionName(event.target.value)}
                      className="w-[136px] bg-transparent px-2.5 text-[13px] font-semibold text-ink outline-none"
                    />
                    <select
                      aria-label="Section names"
                      value=""
                      onChange={(event) => {
                        if (event.target.value) setSectionName(event.target.value);
                      }}
                      className="w-9 bg-transparent text-center text-[12px] font-bold text-muted outline-none"
                    >
                      <option value="">⌄</option>
                      {sectionNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value="more" disabled>
                        ────────
                      </option>
                      {moreSectionNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={!canStart}
                    onClick={startSection}
                    className={
                      canStart
                        ? "h-8 rounded-[10px] bg-primary px-2.5 text-[13px] font-semibold text-white"
                        : "h-8 rounded-[10px] bg-background px-2.5 text-[13px] font-semibold text-disabled"
                    }
                  >
                    Start section here
                  </button>
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <NudgeButton label="− Beat" onClick={() => nudge(-1)} />
                    <NudgeButton label="−" onClick={() => nudge(-0.1)} />
                    <span className="min-w-[96px] text-center text-[12px] font-semibold text-ink tabular-nums">{leadLabel(leadBeats)}</span>
                    <NudgeButton label="+" onClick={() => nudge(0.1)} />
                    <NudgeButton label="+ Beat" onClick={() => nudge(1)} />
                  </div>
                </div>
                <p className="mt-3 text-[12px] text-muted">Nudge if the first beat feels early or late. Section edges stay on the bar.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    aria-label="Cue"
                    value={cueText}
                    placeholder="Cue"
                    onChange={(event) => setCueText(event.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-[10px] bg-background px-2.5 text-[13px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
                  />
                  <button
                    type="button"
                    disabled={!cueText.trim()}
                    onClick={addCue}
                    className={
                      cueText.trim()
                        ? "h-8 rounded-[10px] bg-primary px-2.5 text-[13px] font-semibold text-white"
                        : "h-8 rounded-[10px] bg-background px-2.5 text-[13px] font-semibold text-disabled"
                    }
                  >
                    Add cue
                  </button>
                </div>
              </div>
              {rehearsal && sections.length > 0 ? (
                <LyricsPane
                  sections={sections}
                  lyrics={lyrics}
                  selectedBar={shownBar}
                  editing={editingLyrics}
                  draftLines={draftLines}
                  onDraft={setDraftLines}
                  onBegin={beginLyrics}
                  onFinish={finishLyrics}
                  onSelect={chooseBar}
                />
              ) : null}
              {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}
            </>
          ) : (
            <p className="pt-6 text-[16px] text-muted">Choose Track 1 before marking sections on the audio.</p>
          )}
        </div>
      ) : null}

      {segment === "sections" ? (
        <ul className="mt-4 grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto">
          {sections.length === 0 ? (
            <li className="pt-2 text-[16px] text-muted">Mark sections on the track.</li>
          ) : (
            sections.map((section, index) => (
              <li key={section.id} className="flex items-center gap-3 rounded-xl bg-surface px-3.5 py-3.5">
                <span className="h-10 w-1.5 shrink-0 rounded-[3px]" style={{ backgroundColor: sectionColor(section.name) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold text-ink">{section.name}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">{barLabel(section.bars)}</span>
                </span>
                <RowMenu
                  label={`${section.name} actions`}
                  items={[
                    {
                      label: "Duplicate",
                      onSelect: () => {
                        const copy = { ...section, id: crypto.randomUUID() };
                        const next = sections.slice();
                        next.splice(index + 1, 0, copy);
                        apply(next, cues);
                      },
                    },
                    {
                      label: "+4 Bars",
                      onSelect: () => {
                        const next = sections.slice();
                        next[index] = { ...section, bars: section.bars + 4 };
                        apply(next, cues);
                      },
                    },
                    {
                      label: "-4 Bars",
                      disabled: section.bars <= 4,
                      onSelect: () => {
                        const next = sections.slice();
                        next[index] = { ...section, bars: Math.max(1, section.bars - 4) };
                        apply(next, cues);
                      },
                    },
                    {
                      label: "Move up",
                      disabled: index === 0,
                      onSelect: () => apply(moveSection(sections, index, index - 1), cues),
                    },
                    {
                      label: "Move down",
                      disabled: index === sections.length - 1,
                      onSelect: () => apply(moveSection(sections, index, index + 1), cues),
                    },
                    {
                      label: "Delete",
                      disabled: sections.length === 1,
                      onSelect: () => apply(sections.filter((item) => item.id !== section.id), cues),
                    },
                  ]}
                />
              </li>
            ))
          )}
        </ul>
      ) : null}

      {segment === "cues" ? (
        <ul className="mt-4 grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto">
          {cues.length === 0 ? (
            <li className="pt-2 text-[16px] text-muted">
              {song.stemKey ? "Add cues on the wave under Tracks. They play on Out 3." : "No cues in this song."}
            </li>
          ) : (
            cues.map((cue, index) => (
              <li key={`${cue.bar}-${cue.text}-${index}`} className="flex items-center gap-3 rounded-xl bg-surface px-3.5 py-3.5">
                <span
                  className="h-10 w-1.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: sectionColor(sectionAtBar(stored(sections), cue.bar)) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold text-ink">{cue.text}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">
                    Bar {cue.bar} · {sectionAtBar(stored(sections), cue.bar)} · Out 3
                  </span>
                </span>
                <RowMenu
                  label={`${cue.text} actions`}
                  items={[
                    {
                      label: "Delete",
                      onSelect: () => apply(sections, cues.filter((_, cueIndex) => cueIndex !== index)),
                    },
                  ]}
                />
              </li>
            ))
          )}
        </ul>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#e4372d]">{error}</p> : null}
    </div>
  );
}

function Wave({
  sections,
  cues,
  totalBars,
  peaks,
  beatsPerBar,
  leadBeats,
  playhead,
  selectedBar,
  onSelect,
  onMoveEdge,
}: {
  sections: EditSection[];
  cues: SongCue[];
  totalBars: number;
  peaks: number[] | null;
  beatsPerBar: number;
  leadBeats: number;
  playhead: number;
  selectedBar: number;
  onSelect: (bar: number) => void;
  onMoveEdge: (index: number, bar: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number; originX: number; originBar: number; bar: number } | null>(null);
  const [drag, setDrag] = useState<{ index: number; originX: number; originBar: number; bar: number } | null>(null);
  const [theme, setTheme] = useState("dark");
  const [frameWidth, setFrameWidth] = useState(0);
  const shown = drag ? previewEdge(sections, drag.index, drag.bar) : sections;
  const barSize = Math.max(barWidth, frameWidth / Math.max(totalBars, 1));
  const width = barSize * Math.max(totalBars, 1);
  const step = rulerStep(barSize);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const measure = () => setFrameWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = laneHeight * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, laneHeight);
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#ebebea";
    const beatWidth = barSize / Math.max(beatsPerBar, 1);
    context.lineWidth = 1;
    for (let bar = 0; bar < totalBars; bar += 1) {
      for (let beat = 0; beat < beatsPerBar; beat += 1) {
        const x = bar * barSize + beat * beatWidth;
        context.strokeStyle = withAlpha(ink, beat === 0 ? 0.14 : 0.05);
        context.beginPath();
        context.moveTo(x, headerHeight);
        context.lineTo(x, laneHeight);
        context.stroke();
      }
    }
    if (!peaks?.length) return;
    const top = headerHeight + 8;
    const bottom = laneHeight - 8;
    const mid = (top + bottom) / 2;
    const amplitude = (bottom - top) / 2;
    const origin = (leadBeats / Math.max(beatsPerBar, 1)) * barSize;
    const sample = width / peaks.length;
    context.beginPath();
    context.moveTo(origin + sample / 2, mid - peaks[0] * amplitude);
    peaks.forEach((peak, index) => {
      context.lineTo(origin + index * sample + sample / 2, mid - peak * amplitude);
    });
    for (let index = peaks.length - 1; index >= 0; index -= 1) {
      context.lineTo(origin + index * sample + sample / 2, mid + peaks[index] * amplitude);
    }
    context.closePath();
    context.fillStyle = withAlpha(ink, 0.92);
    context.fill();
    context.strokeStyle = withAlpha(ink, 0.16);
    context.beginPath();
    context.moveTo(0, mid);
    context.lineTo(width, mid);
    context.stroke();
  }, [peaks, width, totalBars, beatsPerBar, leadBeats, theme, barSize]);

  let start = 0;
  const boundaries = shown.slice(0, -1).map((section, index) => {
    start += section.bars;
    return { index, bar: start };
  });
  start = 0;

  return (
    <div ref={frameRef} className="shrink-0 overflow-x-auto rounded-xl bg-background">
      <div className="relative" style={{ width }}>
        <div className="flex" style={{ height: rulerHeight }}>
          {Array.from({ length: totalBars }, (_, index) => {
            const bar = index + 1;
            const marked = bar === 1 || bar % step === 0;
            return (
              <span
                key={bar}
                className={`pl-1 text-[11px] ${bar === selectedBar ? "font-bold text-ink" : "font-medium text-muted"}`}
                style={{ width: barSize }}
              >
                {marked ? bar : ""}
              </span>
            );
          })}
        </div>
        <div className="relative" style={{ height: laneHeight }}>
          {shown.map((section) => {
            const left = start * barSize;
            const band = section.bars * barSize;
            start += section.bars;
            const neutral = section.name.trim().toLowerCase() === "song";
            const color = sectionColor(section.name);
            return (
              <div key={section.id} className="absolute top-0 h-full" style={{ left, width: band }}>
                <div
                  className={`flex h-6 items-center overflow-hidden px-2 text-[12px] font-semibold ${neutral ? "text-ink" : "text-white"}`}
                  style={{ backgroundColor: neutral ? "var(--surface-elevated)" : color }}
                >
                  {section.name}
                </div>
                <div className="h-[calc(100%-24px)]" style={{ backgroundColor: color, opacity: neutral ? 0.08 : 0.16 }} />
              </div>
            );
          })}
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          {cues.map((cue, index) => {
            const place = cue.place ?? cue.bar - 1 + 0.35;
            const y = headerHeight + (cue.y ?? 0.62) * (laneHeight - headerHeight);
            return (
              <span
                key={`${cue.text}-${index}`}
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 truncate rounded-full px-2.5 py-1 text-[13px] font-semibold text-[#1A242C] shadow-[0_1px_4px_rgb(0_0_0/0.28)]"
                style={{ left: place * barSize, top: y, backgroundColor: cueColor(cue.text) }}
              >
                {cue.text}
              </span>
            );
          })}
          <span className="pointer-events-none absolute top-0 z-10 h-full w-px bg-ink" style={{ left: playhead * barSize }} />
          {boundaries.map((edge) => (
            <button
              key={edge.index}
              type="button"
              aria-label={`Move section edge at bar ${edge.bar + 1}`}
              className="absolute z-20 w-7 -translate-x-1/2 cursor-ew-resize"
              style={{ left: edge.bar * barSize, top: 0, height: laneHeight }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                const boundary = edge.bar + 1;
                const next = { index: edge.index, originX: event.clientX, originBar: boundary, bar: boundary };
                dragRef.current = next;
                setDrag(next);
              }}
              onPointerMove={(event) => {
                const current = dragRef.current;
                if (!current || current.index !== edge.index) return;
                const shifted = current.originBar + Math.round((event.clientX - current.originX) / barSize);
                const sectionStart = sections.slice(0, edge.index).reduce((sum, section) => sum + section.bars, 1);
                const total = sections[edge.index].bars + (sections[edge.index + 1]?.bars ?? 0);
                const bar = Math.min(Math.max(shifted, sectionStart + 1), sectionStart + total - 1);
                const next = { ...current, bar };
                dragRef.current = next;
                setDrag(next);
              }}
              onPointerUp={() => {
                const current = dragRef.current;
                dragRef.current = null;
                setDrag(null);
                if (current && current.bar !== current.originBar) onMoveEdge(current.index, current.bar);
              }}
            >
              <span className="absolute left-1/2 top-1.5 h-[18px] w-2 -translate-x-1/2 rounded-full bg-ink shadow-[0_1px_2px_rgb(0_0_0/0.35)]" />
            </button>
          ))}
          <button
            type="button"
            aria-label="Choose a bar"
            className="absolute inset-0 z-0"
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const place = Math.min(Math.max((event.clientX - bounds.left) / barSize, 0), totalBars - 0.0001);
              onSelect(Math.min(Math.max(Math.floor(place) + 1, 1), totalBars));
            }}
          />
        </div>
      </div>
    </div>
  );
}

function LyricsPane({
  sections,
  lyrics,
  selectedBar,
  editing,
  draftLines,
  onDraft,
  onBegin,
  onFinish,
  onSelect,
}: {
  sections: EditSection[];
  lyrics: string;
  selectedBar: number;
  editing: boolean;
  draftLines: string[];
  onDraft: (lines: string[]) => void;
  onBegin: () => void;
  onFinish: () => void;
  onSelect: (bar: number) => void;
}) {
  const blocks = lyricBlocks(lyrics, stored(sections));
  const current = sectionAtBar(stored(sections), selectedBar);
  const currentLines = blocks.find((block) => block.name === current)?.lines ?? [];
  const hasLyrics = blocks.some((block) => block.lines.length > 0);

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface">
      {editing ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[15px] font-semibold text-ink">Lyrics</span>
            <button type="button" onClick={onFinish} className="text-[14px] font-semibold text-primary">
              Done
            </button>
          </div>
          <div className="grid gap-4 px-4 pb-4">
            {sections.map((section, index) => (
              <label key={section.id} className="grid gap-2">
                <span className="text-[13px] font-semibold" style={{ color: sectionColor(section.name) }}>
                  {section.name}
                </span>
                <textarea
                  aria-label={`${section.name} lyrics`}
                  value={draftLines[index] ?? ""}
                  rows={3}
                  onChange={(event) => {
                    const next = draftLines.slice();
                    next[index] = event.target.value;
                    onDraft(next);
                  }}
                  className="resize-none rounded-[10px] bg-background px-3 py-2 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
                />
              </label>
            ))}
          </div>
        </div>
      ) : !hasLyrics ? (
        <div className="grid min-h-0 flex-1 place-items-center gap-3 text-center">
          <p className="text-[22px] font-semibold text-ink">No lyrics yet</p>
          <button type="button" onClick={onBegin} className="text-[15px] font-semibold text-primary">
            Add lyrics
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <span className="text-[22px] font-semibold tracking-wide" style={{ color: sectionColor(current) }}>
              {current}
            </span>
            <button type="button" onClick={onBegin} className="text-[14px] font-semibold text-primary">
              Edit
            </button>
          </div>
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-3 px-5 pb-5">
              {currentLines.length === 0 ? (
                <p className="text-[20px] font-medium text-muted">No lyrics in this section</p>
              ) : (
                currentLines.map((line, index) => (
                  <p key={`${line}-${index}`} className={index === 0 ? "text-[28px] font-semibold text-ink" : "text-[20px] font-medium text-muted"}>
                    {line}
                  </p>
                ))
              )}
            </div>
            <div className="border-l border-background px-4 pb-4">
              <p className="py-2 text-[12px] text-muted">Tap the line you're singing</p>
              {blocks.map((block, index) => {
                const start = sections.slice(0, index).reduce((sum, section) => sum + section.bars, 1);
                return (
                  <div key={`${block.name}-${index}`} className="mb-3">
                    <p className="text-[13px] font-semibold" style={{ color: sectionColor(block.name) }}>
                      {block.name}
                    </p>
                    {block.lines.map((line, lineIndex) => (
                      <button
                        key={`${index}-${lineIndex}`}
                        type="button"
                        onClick={() => onSelect(start)}
                        className={`mt-1 block w-full rounded-md px-2 py-1 text-left text-[14px] ${block.name === current && lineIndex === 0 ? "bg-primary text-white" : "text-ink"}`}
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NudgeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${label.length < 3 ? "min-w-7" : "min-w-14"} h-7 rounded-lg bg-background px-1.5 text-[12px] font-semibold text-ink`}
    >
      {label}
    </button>
  );
}

function leadLabel(beats: number) {
  if (Math.abs(beats) < 0.05) return "On the bar";
  const tenths = Math.round(Math.abs(beats) * 10);
  const number = tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
  const unit = tenths === 10 ? "beat" : "beats";
  return beats > 0 ? `${number} ${unit} later` : `${number} ${unit} earlier`;
}

function rulerStep(width: number) {
  const needed = Math.max(Math.ceil(32 / Math.max(width, 1)), 1);
  return [1, 10, 20, 50, 100, 200].find((mark) => mark >= needed) ?? 200;
}

function withAlpha(color: string, alpha: number) {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return `rgba(235,235,234,${alpha})`;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function previewEdge(sections: EditSection[], index: number, bar: number) {
  if (index < 0 || index + 1 >= sections.length) return sections;
  const next = sections.slice();
  const start = sections.slice(0, index).reduce((sum, section) => sum + section.bars, 1);
  const total = sections[index].bars + sections[index + 1].bars;
  const left = Math.min(Math.max(bar - start, 1), total - 1);
  next[index] = { ...sections[index], bars: left };
  next[index + 1] = { ...sections[index + 1], bars: total - left };
  return next;
}

async function persist(
  showId: string,
  songId: string,
  sections: EditSection[],
  cues: SongCue[],
  leadBeats: number,
  slipBars: number,
  lyrics: string,
  setError: (message: string | null) => void,
) {
  const result = await saveArrangement(showId, songId, stored(sections), cues, leadBeats, slipBars, lyrics);
  setError(result.error);
}

function freshSection(name: string, bars: number): EditSection {
  return { id: crypto.randomUUID(), name, bars, sourceIndex: 0, sourceStartBar: 0, sourceBars: bars };
}

function withIds(sections: SongSection[]): EditSection[] {
  return sections.map((section) => ({ ...section, id: crypto.randomUUID() }));
}

function stored(sections: EditSection[]): SongSection[] {
  return sections.map(({ id: _id, ...section }) => section);
}

function splitAt(sections: EditSection[], bar: number, name: string) {
  let cursor = 1;
  const index = sections.findIndex((section) => {
    const contains = bar > cursor && bar < cursor + section.bars;
    cursor += section.bars;
    return contains;
  });
  if (index < 0) return null;
  const sectionStart = sections.slice(0, index).reduce((sum, section) => sum + section.bars, 1);
  const leftBars = bar - sectionStart;
  const section = sections[index];
  if (leftBars <= 0 || leftBars >= section.bars) return null;
  const right: EditSection = {
    id: crypto.randomUUID(),
    name,
    bars: section.bars - leftBars,
    sourceIndex: section.sourceIndex,
    sourceStartBar: (section.sourceStartBar ?? 0) + leftBars,
    sourceBars: section.bars - leftBars,
  };
  return [
    ...sections.slice(0, index),
    { ...section, bars: leftBars, sourceBars: leftBars },
    right,
    ...sections.slice(index + 1),
  ];
}

function shiftEdge(sections: EditSection[], index: number, toBar: number) {
  if (index < 0 || index + 1 >= sections.length) return null;
  const start = sections.slice(0, index).reduce((sum, section) => sum + section.bars, 1);
  const total = sections[index].bars + sections[index + 1].bars;
  const leftBars = Math.min(Math.max(toBar - start, 1), total - 1);
  const delta = leftBars - sections[index].bars;
  if (delta === 0) return null;
  const left = sections[index];
  const right = sections[index + 1];
  const contiguous = (right.sourceStartBar ?? 0) === (left.sourceStartBar ?? 0) + (left.sourceBars ?? left.bars);
  const next = sections.slice();
  next[index] = { ...left, bars: leftBars, sourceBars: contiguous ? (left.sourceBars ?? left.bars) + delta : left.sourceBars };
  next[index + 1] = {
    ...right,
    bars: right.bars - delta,
    sourceStartBar: contiguous ? (right.sourceStartBar ?? 0) + delta : right.sourceStartBar,
    sourceBars: contiguous ? (right.sourceBars ?? right.bars) - delta : right.sourceBars,
  };
  return next;
}

function moveSection(sections: EditSection[], from: number, to: number) {
  const next = sections.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function peaksFrom(buffer: AudioBuffer, count: number) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const size = Math.max(1, Math.floor(buffer.length / count));
  const peaks: number[] = [];
  for (let index = 0; index < count; index += 1) {
    let peak = 0;
    const start = index * size;
    for (let sample = start; sample < start + size && sample < buffer.length; sample += 16) {
      let level = 0;
      for (const channel of channels) level += Math.abs(channel[sample] ?? 0);
      peak = Math.max(peak, level / channels.length);
    }
    peaks.push(peak);
  }
  const loudest = Math.max(...peaks, 0.001);
  return peaks.map((peak) => peak / loudest);
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${disabled ? "text-disabled" : "text-ink"}`}
    >
      {children}
    </button>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.2 6.2 3.4 9l2.8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.6 9h5.1a3.2 3.2 0 1 0 0-6.4H7.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.8 6.2 12.6 9 9.8 11.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.4 9H7.3a3.2 3.2 0 1 1 0-6.4H8.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M5.2 3.2v9.6l7.2-4.8-7.2-4.8Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M4.2 3h2.4v10H4.2zm5.2 0h2.4v10H9.4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.2 6.2V4.4h7.2M11.2 3.2 12.8 4.4 11.2 5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.8 9.8v1.8H5.6M4.8 12.8 3.2 11.6 4.8 10.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
