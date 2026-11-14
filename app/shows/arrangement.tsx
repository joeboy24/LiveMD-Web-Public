"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { RowMenu } from "../components/row-menu";
import { readAudio, saveArrangement, saveStemLayers, signUpload } from "./actions";
import { THEME_EVENT } from "../theme";
import { makeClickBuffer } from "./click-track";
import { barLabel, cueColor, encodeSectionLyrics, lyricBlocks, moreSectionNames, sectionAtBar, sectionColor, sectionNames } from "./structure";
import type { Song, SongCue, SongSection } from "./types";

const fullBarWidth = 92;
const rulerHeight = 28;
const laneHeight = 132;
const headerHeight = 24;

type EditSection = SongSection & { id: string };
type Segment = "tracks" | "sections" | "cues";
type Snap = {
  sections: EditSection[];
  cues: SongCue[];
  leadBeats: number;
  slipBars: number;
  lyrics: string;
  trackKeys: string[];
  guideKey: string | null;
};
type MixChannel = { level: number; muted: boolean; solo: boolean };
type Mix = { stems: MixChannel; click: MixChannel; cues: MixChannel; layers: Record<string, MixChannel> };
type StemLayer = { id: string; name: string; key: string; guide: boolean; main: boolean };
type LoadedLayer = { id: string; buffer: AudioBuffer; main: boolean };

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
  const [selectedBar, setSelectedBar] = useState(1);
  const [playhead, setPlayhead] = useState(0);
  const [waveScale, setWaveScale] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [rehearsal, setRehearsal] = useState(false);
  const [mix, setMix] = useState<Mix>({ stems: freshChannel(), click: freshChannel(), cues: freshChannel(), layers: {} });
  const [layerList, setLayerList] = useState<StemLayer[]>(() => stemLayers(song));
  const [layersOpen, setLayersOpen] = useState(false);
  const [addingAudio, setAddingAudio] = useState<"track" | "guide" | null>(null);
  const [ready, setReady] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(song.stemKey ? 0 : null);
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
  const trackKeysRef = useRef(song.trackKeys);
  const guideKeyRef = useRef(song.guideKey);
  const playheadRef = useRef(0);
  const barSizeRef = useRef(fullBarWidth);
  const revealRef = useRef<(chart: number) => void>(() => {});
  const spokenRef = useRef<Array<{ bar: number; place: number; text: string }>>([]);
  const heardBarsRef = useRef<number | null>(null);
  const scrubbingRef = useRef(false);
  const totalRef = useRef(1);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const clickRef = useRef<AudioBuffer | null>(null);
  const clickKeyRef = useRef("");
  const audioRef = useRef<AudioContext | null>(null);
  const layersRef = useRef<LoadedLayer[]>([]);
  const sourcesRef = useRef<Array<{ id: string; source: AudioBufferSourceNode }>>([]);
  const gainsRef = useRef<Map<string, GainNode>>(new Map());
  const removedRef = useRef(new Set<string>());
  const mixRef = useRef(mix);
  const mixerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const trackInputRef = useRef<HTMLInputElement>(null);
  const guideInputRef = useRef<HTMLInputElement>(null);
  const armTokenRef = useRef(0);
  const armingRef = useRef(false);
  const uploadRef = useRef(false);
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
  mixRef.current = mix;

  const totalBars = Math.max(sections.reduce((sum, section) => sum + section.bars, 0), 1);
  totalRef.current = totalBars;
  const canStart = splitAt(sections, Math.min(selectedBar, totalBars), sectionName.trim() || "Verse") !== null;

  useEffect(() => {
    const files = stemLayers(song);
    if (!files.some((layer) => layer.main)) return;
    const controller = new AbortController();
    let alive = true;
    const showLoadBar = bufferRef.current === null;
    const ratios = new Map(files.map((layer) => [layer.id, 0]));
    const publish = () => {
      if (!showLoadBar) return;
      let sum = 0;
      ratios.forEach((value) => {
        sum += value;
      });
      setProgress(Math.min(sum / ratios.size, 0.98));
    };
    if (showLoadBar) publish();
    Promise.all(
      files.map(async (layer) => {
        try {
          const signed = await readAudio(showId, layer.key);
          if (!alive) return null;
          if ("error" in signed) return layer.main ? signed : null;
          const bytes = await readBytes(signed.url, controller.signal, (ratio) => {
            ratios.set(layer.id, ratio * 0.85);
            publish();
          });
          if (!alive) return null;
          const context = new AudioContext();
          const buffer = await context.decodeAudioData(bytes);
          await context.close();
          ratios.set(layer.id, 1);
          publish();
          return { id: layer.id, buffer, main: layer.main };
        } catch (reason) {
          if (reason instanceof DOMException && reason.name === "AbortError") throw reason;
          return null;
        }
      }),
    )
      .then((loaded) => {
        if (!alive) return;
        const readyLayers = loaded.filter((item): item is LoadedLayer => item !== null && "buffer" in item && !removedRef.current.has(item.id));
        const main = readyLayers.find((item) => item.main);
        if (!main) {
          const failed = loaded.find((item) => item !== null && "error" in item);
          setProgress(null);
          setStatus(failed && "error" in failed ? failed.error ?? "The track didn't load." : "The track didn't load.");
          return;
        }
        layersRef.current = readyLayers;
        bufferRef.current = main.buffer;
        const barDuration = (Math.max(song.beatsPerBar, 1) * 60) / Math.max(song.tempo, 1);
        const bars = Math.max(1, Math.round(main.buffer.duration / barDuration));
        setReady(true);
        setPeaks(peaksFrom(main.buffer, bars * 8));
        if (showLoadBar) setProgress(null);
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
        setProgress(null);
        setStatus("The track didn't load.");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [showId, song.id, song.stemKey, song.guideKey, song.trackKeys, song.beatsPerBar, song.tempo]);

  function snapshot(): Snap {
    return {
      sections: sectionsRef.current,
      cues: cuesRef.current,
      leadBeats: leadRef.current,
      slipBars: slipRef.current,
      lyrics: lyricsRef.current,
      trackKeys: trackKeysRef.current.slice(),
      guideKey: guideKeyRef.current,
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
    nextTracks = trackKeysRef.current.slice(),
    nextGuide = guideKeyRef.current,
  ) {
    if (record) remember();
    const tracksChanged = nextGuide !== guideKeyRef.current || !sameKeys(nextTracks, trackKeysRef.current);
    if (tracksChanged) {
      const kept = new Set(stemLayers({ stemKey: song.stemKey, trackKeys: nextTracks, guideKey: nextGuide }).map((layer) => layer.id));
      for (const layer of stemLayers({ stemKey: song.stemKey, trackKeys: trackKeysRef.current, guideKey: guideKeyRef.current })) {
        if (!layer.main && !kept.has(layer.id)) removedRef.current.add(layer.id);
      }
    }
    sectionsRef.current = nextSections;
    cuesRef.current = nextCues;
    leadRef.current = nextLead;
    slipRef.current = nextSlip;
    lyricsRef.current = nextLyrics;
    trackKeysRef.current = nextTracks;
    guideKeyRef.current = nextGuide;
    setSections(nextSections);
    setCues(nextCues);
    setLeadBeats(nextLead);
    setSlipBars(nextSlip);
    setLyrics(nextLyrics);
    if (tracksChanged) {
      void saveStemLayers(showId, song.id, nextTracks, nextGuide).then((result) => {
        if (result.error) setError(result.error);
      });
      void adoptLayers(nextTracks, nextGuide);
    }
    void persist(showId, song.id, nextSections, nextCues, nextLead, nextSlip, nextLyrics, setError);
  }

  function undo() {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current.push(snapshot());
    apply(
      previous.sections,
      previous.cues,
      false,
      previous.leadBeats,
      previous.slipBars,
      previous.lyrics,
      previous.trackKeys ?? trackKeysRef.current.slice(),
      previous.guideKey === undefined ? guideKeyRef.current : previous.guideKey,
    );
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(true);
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(snapshot());
    apply(
      next.sections,
      next.cues,
      false,
      next.leadBeats,
      next.slipBars,
      next.lyrics,
      next.trackKeys ?? trackKeysRef.current.slice(),
      next.guideKey === undefined ? guideKeyRef.current : next.guideKey,
    );
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
  }

  function startSection() {
    const next = splitAt(sections, Math.min(selectedBar, totalBars), sectionName.trim() || "Verse");
    if (next) apply(next, cues);
  }

  function moveCue(index: number, place: number, y: number) {
    const current = cuesRef.current;
    const cue = current[index];
    if (!cue) return;
    const bar = Math.min(totalRef.current, Math.max(1, Math.floor(place) + 1));
    const sameBar = cue.bar === bar;
    const samePlace = Math.abs((cue.place ?? place) - place) < 0.02;
    const sameY = Math.abs((cue.y ?? y) - y) < 0.02;
    if (sameBar && samePlace && sameY) return;
    const next = current.map((item, itemIndex) => (itemIndex === index ? { ...item, bar, place, y } : item));
    next.sort((left, right) => (left.place ?? left.bar) - (right.place ?? right.bar));
    apply(sectionsRef.current, next);
  }

  function addCueAt(place: number, y: number, text: string) {
    const trimmed = text.trim().slice(0, 80);
    if (!trimmed || cuesRef.current.length >= 200) return;
    const bar = Math.min(totalRef.current, Math.max(1, Math.floor(place) + 1));
    const next = [...cuesRef.current, { bar, text: trimmed, place, y: Math.min(0.94, Math.max(0.06, y)) }].sort(
      (left, right) => (left.place ?? left.bar) - (right.place ?? right.bar),
    );
    apply(sectionsRef.current, next);
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

  function publishHead(chart: number) {
    const next = Math.min(Math.max(chart, 0), Math.max(totalRef.current - 0.0001, 0));
    playheadRef.current = next;
    setPlayhead(next);
    setSelectedBar(Math.min(totalRef.current, Math.max(1, Math.floor(next) + 1)));
    return next;
  }

  function placeHead(chart: number, resume: boolean) {
    const next = publishHead(chart);
    if (playingRef.current && resume) {
      startAt(next);
      return;
    }
    if (loopRange.current) loopRange.current = spanAt(next);
  }

  function scrubTo(chart: number) {
    scrubbingRef.current = true;
    publishHead(chart);
  }

  function endScrub() {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    const chart = playheadRef.current;
    if (loopRange.current) loopRange.current = spanAt(chart);
    if (playingRef.current) startAt(chart);
  }

  function silenceCues(forget: boolean) {
    window.speechSynthesis?.cancel();
    if (!forget) return;
    spokenRef.current = [];
    heardBarsRef.current = null;
  }

  function speakCues(bars: number) {
    const previous = heardBarsRef.current;
    if (previous !== null && bars + 0.08 < previous) {
      spokenRef.current = spokenRef.current.filter((mark) => mark.place < bars - 0.05);
    }
    heardBarsRef.current = bars;
    const gain = busGain(mixRef.current.cues, mixRef.current);
    const synth = window.speechSynthesis;
    if (!synth || gain <= 0.001) {
      if (gain <= 0.001) synth?.cancel();
      return;
    }
    const delta = bars - (previous ?? bars);
    for (const cue of cuesRef.current) {
      const text = cue.text.trim();
      if (!text) continue;
      const anchor = cue.place ?? Math.max(cue.bar - 1, 0) + 0.35;
      const place = cueSpeechPlace(text, anchor, barSizeRef.current);
      const crossed = previous !== null && delta > 0 && delta < 1.25 && previous < place && bars >= place;
      const landed = (previous === null || delta < -0.08 || delta >= 1.25) && Math.abs(bars - place) < 0.2;
      if (!crossed && !landed) continue;
      if (spokenRef.current.some((mark) => mark.bar === cue.bar && mark.text === text && mark.place === place)) continue;
      spokenRef.current.push({ bar: cue.bar, place, text });
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = gain;
      utterance.rate = 1;
      synth.resume();
      synth.speak(utterance);
    }
  }

  function halt(forgetCues = false) {
    tokenRef.current += 1;
    armTokenRef.current += 1;
    armingRef.current = false;
    if (!uploadRef.current) setProgress(null);
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    playRef.current = null;
    const sources = sourcesRef.current;
    sourcesRef.current = [];
    for (const item of sources) {
      try {
        item.source.stop();
      } catch {
        // The source already finished.
      }
    }
    silenceCues(forgetCues);
  }

  function follow() {
    if (scrubbingRef.current) {
      const anchor = playRef.current;
      const context = audioRef.current;
      if (anchor && context && playingRef.current) {
        const heard = anchor.chart + (context.currentTime - anchor.contextTime) / barSeconds();
        if (Math.abs(heard - playheadRef.current) * barSeconds() > 0.3) {
          startAt(playheadRef.current);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(follow);
      return;
    }
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
      halt(true);
      placeHead(Math.max(totalRef.current - 0.0001, 0), false);
      return;
    }
    playheadRef.current = chart;
    setPlayhead(chart);
    setSelectedBar(Math.min(totalRef.current, Math.max(1, Math.floor(chart) + 1)));
    speakCues(chart);
    rafRef.current = requestAnimationFrame(follow);
  }

  function startAt(chart: number) {
    const layers = layersRef.current.filter((layer) => !removedRef.current.has(layer.id));
    if (!layers.some((layer) => layer.main)) return;
    const context = audioRef.current ?? new AudioContext();
    audioRef.current = context;
    void context.resume();
    tokenRef.current += 1;
    const token = tokenRef.current;
    for (const item of sourcesRef.current) {
      try {
        item.source.stop();
      } catch {
        // The previous source already finished.
      }
    }
    const beats = Math.max(song.beatsPerBar, 1);
    const seconds = ((chart * beats - leadRef.current) * 60) / Math.max(song.tempo, 1);
    const delay = Math.max(0, -seconds);
    const ids = layers.map((layer) => layer.id);
    const sources: Array<{ id: string; source: AudioBufferSourceNode }> = [];
    for (const layer of layers) {
      const offset = Math.min(Math.max(seconds, 0), Math.max(layer.buffer.duration - 0.02, 0));
      if (layer.buffer.duration - offset <= 0.02) continue;
      const source = context.createBufferSource();
      source.buffer = layer.buffer;
      source.connect(gainFor(layer.id, context, ids));
      if (layer.main) {
        source.onended = () => {
          if (tokenRef.current !== token || !playingRef.current) return;
          halt(true);
          placeHead(Math.max(totalRef.current - 0.0001, 0), false);
        };
      }
      source.start(context.currentTime + delay, offset);
      sources.push({ id: layer.id, source });
    }
    const click = clickBuffer(context);
    const clickOffset = Math.min(Math.max(chart * barSeconds(), 0), Math.max(click.duration - 0.02, 0));
    if (click.duration - clickOffset > 0.02) {
      const source = context.createBufferSource();
      source.buffer = click;
      source.connect(gainFor("click", context, ids));
      source.start(context.currentTime, clickOffset);
      sources.push({ id: "click", source });
    }
    sourcesRef.current = sources;
    playRef.current = { contextTime: context.currentTime, chart };
    playingRef.current = true;
    setPlaying(true);
    playheadRef.current = chart;
    setPlayhead(chart);
    setSelectedBar(Math.min(totalRef.current, Math.max(1, Math.floor(chart) + 1)));
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(follow);
  }

  function gainFor(id: string, context: AudioContext, ids: string[]) {
    let node = gainsRef.current.get(id);
    if (!node || node.context !== context) {
      node?.disconnect();
      node = context.createGain();
      node.connect(context.destination);
      gainsRef.current.set(id, node);
    }
    node.gain.value = id === "click" ? busGain(mixRef.current.click, mixRef.current) : layerGain(id, mixRef.current, ids);
    return node;
  }

  function clickBuffer(context: AudioContext) {
    const bars = Math.max(totalRef.current, 1);
    const beats = Math.max(song.beatsPerBar, 1);
    const tempo = Math.max(song.tempo, 1);
    const key = `${context.sampleRate}|${bars}|${beats}|${tempo}`;
    if (clickRef.current && clickKeyRef.current === key) return clickRef.current;
    const buffer = makeClickBuffer(context, bars, beats, tempo);
    clickRef.current = buffer;
    clickKeyRef.current = key;
    return buffer;
  }

  async function beginPlay() {
    if (armingRef.current || !bufferRef.current) return;
    armingRef.current = true;
    const token = armTokenRef.current + 1;
    armTokenRef.current = token;
    const showBar = !uploadRef.current;
    if (showBar) setProgress(0.08);
    const context = audioRef.current ?? new AudioContext();
    audioRef.current = context;
    if (showBar) setProgress(0.4);
    await context.resume();
    if (token !== armTokenRef.current) return;
    if (showBar) setProgress(0.85);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    if (token !== armTokenRef.current) return;
    startAt(playheadRef.current);
    armingRef.current = false;
    if (showBar && !uploadRef.current) setProgress(null);
  }

  function togglePlay() {
    if (!bufferRef.current || armingRef.current) return;
    if (playingRef.current) halt();
    else void beginPlay();
  }

  function stop() {
    halt(true);
    placeHead(0, false);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
        if (target.closest("[role=menu]")) return;
      }
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "Enter") {
        event.preventDefault();
        stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
    const ids = layersRef.current.map((layer) => layer.id);
    for (const [id, node] of gainsRef.current) {
      node.gain.value = id === "click" ? busGain(mix.click, mix) : layerGain(id, mix, ids);
    }
    if (busGain(mix.cues, mix) <= 0.001) window.speechSynthesis?.cancel();
  }, [mix]);

  useEffect(() => {
    if (!layersOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (mixerRef.current?.contains(target) || railRef.current?.contains(target)) return;
      setLayersOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [layersOpen]);

  async function loadLayer(layer: StemLayer): Promise<LoadedLayer | null> {
    try {
      const signed = await readAudio(showId, layer.key);
      if ("error" in signed) return null;
      const response = await fetch(signed.url);
      if (!response.ok) return null;
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      await context.close();
      return { id: layer.id, buffer, main: layer.main };
    } catch {
      return null;
    }
  }

  async function adoptLayers(nextTracks: string[], nextGuide: string | null) {
    const layers = stemLayers({ stemKey: song.stemKey, trackKeys: nextTracks, guideKey: nextGuide });
    const ids = new Set(layers.map((layer) => layer.id));
    for (const id of ids) removedRef.current.delete(id);
    const dropped = sourcesRef.current.filter((item) => !ids.has(item.id));
    sourcesRef.current = sourcesRef.current.filter((item) => ids.has(item.id));
    for (const item of dropped) {
      try {
        item.source.stop();
      } catch {
        // The source already finished.
      }
    }
    for (const id of [...gainsRef.current.keys()]) {
      if (ids.has(id)) continue;
      gainsRef.current.get(id)?.disconnect();
      gainsRef.current.delete(id);
    }
    layersRef.current = layersRef.current.filter((item) => ids.has(item.id));
    setLayerList(layers);
    if (layers.length < 2) setLayersOpen(false);
    const have = new Set(layersRef.current.map((item) => item.id));
    const loaded = (await Promise.all(layers.filter((layer) => !have.has(layer.id)).map((layer) => loadLayer(layer)))).filter(
      (item): item is LoadedLayer => item !== null,
    );
    const allowed = new Set(stemLayers({ stemKey: song.stemKey, trackKeys: trackKeysRef.current, guideKey: guideKeyRef.current }).map((layer) => layer.id));
    layersRef.current = [...layersRef.current.filter((item) => allowed.has(item.id)), ...loaded.filter((item) => allowed.has(item.id))];
    if (playingRef.current && loaded.length > 0) startAt(playheadRef.current);
  }

  async function deleteLayer(layer: StemLayer) {
    if (layer.main) return;
    const nextTracks = layer.guide ? trackKeysRef.current.slice() : trackKeysRef.current.filter((key) => key !== layer.key);
    const nextGuide = layer.guide ? null : guideKeyRef.current;
    apply(sectionsRef.current, cuesRef.current, true, leadRef.current, slipRef.current, lyricsRef.current, nextTracks, nextGuide);
  }

  async function addAudio(kind: "track" | "guide", file: File) {
    if (kind === "track" && trackKeysRef.current.length >= 1) return;
    if (kind === "guide" && guideKeyRef.current) return;
    setAddingAudio(kind);
    uploadRef.current = true;
    setProgress(0);
    setError(null);
    try {
      const signed = await signUpload({ showId, fileName: file.name, contentType: file.type, size: file.size });
      if ("error" in signed) throw new Error(signed.error ?? "The audio didn't upload.");
      await uploadFile(signed.url, file, signed.contentType, (ratio) => setProgress(Math.min(ratio * 0.9, 0.9)));
      setProgress(0.92);
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      await context.close();
      const id = kind === "guide" ? `guide:${signed.key}` : signed.key;
      layersRef.current = [...layersRef.current.filter((item) => item.id !== id), { id, buffer: decoded, main: false }];
      setProgress(1);
      if (kind === "track") {
        apply(sectionsRef.current, cuesRef.current, true, leadRef.current, slipRef.current, lyricsRef.current, [...trackKeysRef.current, signed.key], guideKeyRef.current);
      } else {
        apply(sectionsRef.current, cuesRef.current, true, leadRef.current, slipRef.current, lyricsRef.current, trackKeysRef.current.slice(), signed.key);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The audio didn't upload.");
    } finally {
      uploadRef.current = false;
      setAddingAudio(null);
      setProgress(null);
    }
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      for (const item of sourcesRef.current) {
        try {
          item.source.stop();
        } catch {
          // The source already finished.
        }
      }
      void audioRef.current?.close();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const shownBar = Math.min(totalBars, Math.max(1, Math.floor(Math.min(playhead, totalBars - 0.0001)) + 1));
  const shownSection = sectionAtBar(stored(sections), shownBar);
  const canAddTrack = layerList.filter((layer) => !layer.main && !layer.guide).length < 1;
  const canAddGuide = !layerList.some((layer) => layer.guide);
  const preparing = progress !== null && !playing && addingAudio === null;
  const percent = progress === null ? 0 : Math.round(Math.min(Math.max(progress, 0), 1) * 100);

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
          <RowMenu
            label="Arrangement actions"
            items={[
              ...(canAddTrack
                ? [{ label: "Add a track", disabled: addingAudio !== null, onSelect: () => trackInputRef.current?.click() }]
                : []),
              ...(canAddGuide
                ? [{ label: "Add a guide", disabled: addingAudio !== null, onSelect: () => guideInputRef.current?.click() }]
                : []),
              { label: "Reset", onSelect: reset },
            ]}
          />
          <input
            ref={trackInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void addAudio("track", file);
            }}
          />
          <input
            ref={guideInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void addAudio("guide", file);
            }}
          />
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
            aria-label={preparing ? "Preparing" : playing ? "Pause" : "Play"}
            disabled={!ready}
            onClick={togglePlay}
            className="grid size-8 place-items-center rounded-full bg-primary text-[11px] font-bold text-white tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary-hover disabled:opacity-40"
          >
            {preparing ? percent : playing ? <PauseIcon /> : <PlayIcon />}
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

      {progress !== null ? <ReadyBar percent={percent} /> : null}

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
              <div className="relative flex shrink-0 rounded-[14px] border border-ink/10 bg-surface">
                <TrackRail
                  mix={mix}
                  canMix={layerList.length > 1}
                  open={layersOpen}
                  railRef={railRef}
                  onToggle={() => setLayersOpen((open) => !open)}
                  onChannel={(bus, channel) => setMix((current) => ({ ...current, [bus]: channel }))}
                />
                <div className="w-px shrink-0 bg-background" />
                <Wave
                  sections={sections}
                  cues={cues}
                  totalBars={totalBars}
                  peaks={peaks}
                  beatsPerBar={Math.max(song.beatsPerBar, 1)}
                  leadBeats={leadBeats}
                  playhead={Math.min(playhead, totalBars - 0.0001)}
                  waveScale={waveScale}
                  barSizeRef={barSizeRef}
                  revealRef={revealRef}
                  selectedBar={shownBar}
                  onSeek={(chart) => placeHead(chart, true)}
                  onScrub={scrubTo}
                  onScrubEnd={endScrub}
                  onAddCue={addCueAt}
                  onMoveCue={moveCue}
                  onMoveEdge={moveEdge}
                />
                {layersOpen && layerList.length > 1 ? (
                  <StemLayerList
                    panelRef={mixerRef}
                    layers={layerList}
                    mix={mix}
                    onChannel={(id, channel) => setMix((current) => ({ ...current, layers: { ...current.layers, [id]: channel } }))}
                    onDelete={deleteLayer}
                  />
                ) : null}
              </div>
              <div data-cue-strip="" className="mt-2 flex h-[18px] overflow-hidden rounded-[4px] bg-[#3A4450] in-data-[theme=light]:bg-[#D7DEE5]">
                {cues
                  .map((cue, index) => ({ cue, index, place: cue.place ?? cue.bar - 1 + 0.35 }))
                  .sort((left, right) => left.place - right.place)
                  .map(({ cue, index, place }) => (
                    <button
                      key={`${cue.text}-${index}`}
                      type="button"
                      aria-label={`Jump to ${cue.text}`}
                      className="m-0 h-full shrink-0 truncate border-0 px-2 text-[12px] leading-none font-semibold whitespace-nowrap text-[#1A242C]"
                      style={{ backgroundColor: cueColor(cue.text) }}
                      onClick={() => {
                        revealRef.current(place);
                        placeHead(place, true);
                      }}
                    >
                      {cue.text}
                    </button>
                  ))}
              </div>
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
                    <div className="w-[132px]">
                      <MixSlider label="Wave width" value={waveScale} tint="var(--muted)" onChange={setWaveScale} />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[12px] text-muted">Nudge if the first beat feels early or late. Section edges stay on the bar.</p>
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
              {song.stemKey ? "Add cues on the wave under Tracks. They are spoken as the playhead reaches them." : "No cues in this song."}
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
  waveScale,
  barSizeRef,
  revealRef,
  selectedBar,
  onSeek,
  onScrub,
  onScrubEnd,
  onAddCue,
  onMoveCue,
  onMoveEdge,
}: {
  sections: EditSection[];
  cues: SongCue[];
  totalBars: number;
  peaks: number[] | null;
  beatsPerBar: number;
  leadBeats: number;
  playhead: number;
  waveScale: number;
  barSizeRef: RefObject<number>;
  revealRef: RefObject<(chart: number) => void>;
  selectedBar: number;
  onSeek: (chart: number) => void;
  onScrub: (chart: number) => void;
  onScrubEnd: () => void;
  onAddCue: (place: number, y: number, text: string) => void;
  onMoveCue: (index: number, place: number, y: number) => void;
  onMoveEdge: (index: number, bar: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef(false);
  const scrubStart = useRef(0);
  const ignoreClick = useRef(false);
  const cueDrag = useRef<{ index: number; originX: number; originY: number; originPlace: number; originYPos: number; place: number; y: number } | null>(null);
  const [cueLift, setCueLift] = useState<{ index: number; place: number; y: number } | null>(null);
  const draftRef = useRef<{ id: number; place: number; y: number; text: string } | null>(null);
  const draftId = useRef(0);
  const draftInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ id: number; place: number; y: number; text: string } | null>(null);
  const dragRef = useRef<{ index: number; originX: number; originBar: number; bar: number } | null>(null);
  const [drag, setDrag] = useState<{ index: number; originX: number; originBar: number; bar: number } | null>(null);
  const [theme, setTheme] = useState("dark");
  const [frameWidth, setFrameWidth] = useState(0);
  const shown = drag ? previewEdge(sections, drag.index, drag.bar) : sections;
  const barSize = (() => {
    const full = fullBarWidth;
    const fitted = frameWidth > 0 ? frameWidth / Math.max(totalBars, 1) : full;
    const collapsed = Math.min(fitted, full);
    const scale = Math.min(Math.max(waveScale, 0), 1);
    return scale >= 0.999 ? full : collapsed + (full - collapsed) * scale;
  })();
  barSizeRef.current = barSize;
  const width = barSize * Math.max(totalBars, 1);
  const headX = Math.min(Math.max(playhead * barSize, 6), Math.max(width - 6, 6));
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

  function chartAt(clientX: number) {
    const bounds = laneRef.current?.getBoundingClientRect();
    if (!bounds) return 0;
    return Math.min(Math.max((clientX - bounds.left) / barSize, 0), Math.max(totalBars - 0.0001, 0));
  }

  function keepVisible(chart: number) {
    const frame = frameRef.current;
    if (!frame) return;
    const x = chart * barSize;
    const left = frame.scrollLeft;
    const right = left + frame.clientWidth;
    const margin = 40;
    if (x < left + margin) frame.scrollLeft = Math.max(0, x - margin);
    else if (x > right - margin) frame.scrollLeft = x - frame.clientWidth + margin;
  }

  function commitDraft() {
    const current = draftRef.current;
    if (!current) return;
    draftRef.current = null;
    setDraft(null);
    const text = current.text.trim();
    if (text) onAddCue(current.place, current.y, text);
  }

  function openDraft(clientX: number, clientY: number) {
    commitDraft();
    const bounds = laneRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const place = Math.min(Math.max((clientX - bounds.left) / barSize, 0), Math.max(totalBars - 0.0001, 0));
    const y = Math.min(0.94, Math.max(0.06, (clientY - bounds.top - rulerHeight) / laneHeight));
    draftId.current += 1;
    const next = { id: draftId.current, place, y, text: "" };
    draftRef.current = next;
    setDraft(next);
  }

  function beginScrub(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-draft], [data-cue], [data-edge], [data-cue-strip]")) return;
    if (draftRef.current) {
      commitDraft();
      ignoreClick.current = true;
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - bounds.top;
    const x = event.clientX - bounds.left;
    const claimed = y <= rulerHeight + 6 || Math.abs(x - headX) <= 24;
    if (!claimed) return;
    scrubRef.current = true;
    scrubStart.current = event.clientX;
    const chart = chartAt(event.clientX);
    keepVisible(chart);
    onScrub(chart);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is already gone cannot be captured.
    }
  }

  function moveScrub(event: ReactPointerEvent<HTMLDivElement>) {
    if (!scrubRef.current) return;
    if (Math.abs(event.clientX - scrubStart.current) > 4) ignoreClick.current = true;
    const chart = chartAt(event.clientX);
    keepVisible(chart);
    onScrub(chart);
  }

  function finishScrub() {
    if (!scrubRef.current) return;
    scrubRef.current = false;
    onScrubEnd();
  }

  revealRef.current = keepVisible;

  return (
    <div ref={frameRef} className="min-w-0 flex-1 overflow-x-auto rounded-r-[14px] bg-background">
      <div
        ref={laneRef}
        className="relative select-none"
        style={{ width }}
        onPointerDown={beginScrub}
        onPointerMove={moveScrub}
        onPointerUp={finishScrub}
        onPointerCancel={finishScrub}
        onDoubleClick={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("[data-edge], [data-draft], [data-cue-strip]")) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientY - bounds.top <= rulerHeight + 4) return;
          ignoreClick.current = true;
          openDraft(event.clientX, event.clientY);
        }}
      >
        <div className="flex cursor-ew-resize" style={{ height: rulerHeight, touchAction: "none" }}>
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
            const lifted = cueLift?.index === index;
            const place = lifted ? cueLift.place : (cue.place ?? cue.bar - 1 + 0.35);
            const y = (lifted ? cueLift.y : (cue.y ?? 0.62)) * laneHeight;
            return (
              <button
                key={`${cue.text}-${index}`}
                type="button"
                data-cue=""
                aria-label={`Move ${cue.text}`}
                className={`absolute z-[15] max-w-[240px] -translate-x-1/2 -translate-y-1/2 truncate rounded-full px-2.5 py-1 text-[13px] font-semibold text-[#1A242C] shadow-[0_1px_4px_rgb(0_0_0/0.28)] ${lifted ? "cursor-grabbing" : "cursor-grab"}`}
                style={{ left: place * barSize, top: y, backgroundColor: cueColor(cue.text) }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const originPlace = cue.place ?? cue.bar - 1 + 0.35;
                  const originYPos = cue.y ?? 0.62;
                  cueDrag.current = {
                    index,
                    originX: event.clientX,
                    originY: event.clientY,
                    originPlace,
                    originYPos,
                    place: originPlace,
                    y: originYPos,
                  };
                  setCueLift({ index, place: originPlace, y: originYPos });
                }}
                onPointerMove={(event) => {
                  const current = cueDrag.current;
                  if (!current || current.index !== index) return;
                  const place = Math.min(Math.max(current.originPlace + (event.clientX - current.originX) / barSize, 0), Math.max(totalBars - 0.0001, 0));
                  const nextY = Math.min(Math.max(current.originYPos + (event.clientY - current.originY) / laneHeight, 0.06), 0.94);
                  current.place = place;
                  current.y = nextY;
                  setCueLift({ index, place, y: nextY });
                }}
                onPointerUp={() => {
                  const current = cueDrag.current;
                  cueDrag.current = null;
                  setCueLift(null);
                  if (!current || current.index !== index) return;
                  onMoveCue(index, current.place, current.y);
                }}
                onPointerCancel={() => {
                  cueDrag.current = null;
                  setCueLift(null);
                }}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                {cue.text}
              </button>
            );
          })}
          {boundaries.map((edge) => (
            <button
              key={edge.index}
              type="button"
              data-edge=""
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
            aria-label="Move the playhead"
            className="absolute inset-0 z-0"
            onClick={(event) => {
              if (ignoreClick.current || event.detail > 1) {
                ignoreClick.current = false;
                return;
              }
              onSeek(chartAt(event.clientX));
            }}
          />
          {draft ? (
            <form
              data-draft=""
              className="absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full px-1 shadow-[0_2px_8px_rgb(0_0_0/0.35)]"
              style={{ left: draft.place * barSize, top: draft.y * laneHeight, backgroundColor: cueColor(draft.text) }}
              onSubmit={(event) => {
                event.preventDefault();
                commitDraft();
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <input
                ref={draftInputRef}
                aria-label="Cue name"
                value={draft.text}
                placeholder="Cue"
                autoFocus
                data-draft-id={draft.id}
                onChange={(event) => {
                  const text = event.target.value;
                  setDraft((current) => {
                    if (!current) return current;
                    const next = { ...current, text };
                    draftRef.current = next;
                    return next;
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    draftRef.current = null;
                    setDraft(null);
                  }
                }}
                onBlur={(event) => {
                  const id = Number(event.currentTarget.dataset.draftId);
                  if (draftRef.current && draftRef.current.id !== id) return;
                  commitDraft();
                }}
                className="h-7 w-[108px] bg-transparent px-2 text-[13px] font-semibold text-[#1A242C] outline-none placeholder:text-[#1A242C]/45"
              />
            </form>
          ) : null}
        </div>
        <div
          className="pointer-events-none absolute top-0 z-10 drop-shadow-[0_0_1px_rgb(0_0_0/0.55)]"
          style={{ left: headX, height: rulerHeight + laneHeight }}
        >
          <svg width="12" height="8" viewBox="0 0 12 8" className="absolute top-0 left-1/2 -translate-x-1/2 text-ink" aria-hidden="true">
            <path d="M6 8 L0 0 H12 Z" fill="currentColor" />
          </svg>
          <span className="absolute top-2 left-1/2 h-[calc(100%-8px)] w-[1.5px] -translate-x-1/2 bg-ink" />
        </div>
        <button
          type="button"
          aria-label="Drag the playhead"
          className="absolute top-0 z-10 w-12 -translate-x-1/2 cursor-ew-resize border-0 bg-transparent p-0 outline-none"
          style={{ left: headX, height: rulerHeight + laneHeight, touchAction: "none" }}
        />
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

function ReadyBar({ percent }: { percent: number }) {
  return (
    <div className="mt-1 flex h-4 shrink-0 items-center gap-2">
      <div
        className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-ink/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Preparing"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-9 text-right text-[12px] font-semibold leading-none text-muted tabular-nums">{percent}%</span>
    </div>
  );
}

async function readBytes(url: string, signal: AbortSignal, onRatio: (ratio: number) => void) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("load");
  const total = Number(response.headers.get("Content-Length")) || 0;
  if (!response.body) {
    onRatio(1);
    return response.arrayBuffer();
  }
  const reader = response.body.getReader();
  const parts: ArrayBuffer[] = [];
  let received = 0;
  let guessed = 0.05;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    parts.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    received += value.byteLength;
    if (total > 0) onRatio(Math.min(received / total, 1));
    else {
      guessed = Math.min(guessed + 0.07, 0.8);
      onRatio(guessed);
    }
  }
  onRatio(1);
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const part of parts) {
    merged.set(new Uint8Array(part), offset);
    offset += part.byteLength;
  }
  return merged.buffer;
}

function uploadFile(url: string, file: File, contentType: string, onProgress: (ratio: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(event.loaded / event.total, 1));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("The audio didn't upload."));
    };
    request.onerror = () => reject(new Error("The audio didn't upload."));
    request.send(file);
  });
}

function freshChannel(): MixChannel {
  return { level: 1, muted: false, solo: false };
}

function sameKeys(left: string[], right: string[]) {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function stemLayers(song: { stemKey: string | null; trackKeys: string[]; guideKey: string | null }): StemLayer[] {
  const layers: StemLayer[] = [];
  if (song.stemKey) layers.push({ id: song.stemKey, name: "Track 1", key: song.stemKey, guide: false, main: true });
  song.trackKeys.forEach((key, index) => {
    layers.push({ id: key, name: `Track ${index + 2}`, key, guide: false, main: false });
  });
  if (song.guideKey) layers.push({ id: `guide:${song.guideKey}`, name: "Guide", key: song.guideKey, guide: true, main: false });
  return layers;
}

let cueMeasure: HTMLCanvasElement | null = null;

function cueSpeechPlace(text: string, anchor: number, barSize: number) {
  const sample = text.trim() || "Cue";
  const textWidth = measureCueText(sample);
  const shown = barSize >= 88 || textWidth + 20 <= barSize * 1.2;
  if (!shown) return anchor;
  const halfBars = (textWidth + 20) / (2 * Math.max(barSize, 1));
  return Math.max(anchor - halfBars, 0);
}

function measureCueText(text: string) {
  if (typeof document === "undefined") return text.length * 7;
  cueMeasure ??= document.createElement("canvas");
  const context = cueMeasure.getContext("2d");
  if (!context) return text.length * 7;
  context.font = "600 13px system-ui, sans-serif";
  return Math.ceil(context.measureText(text).width);
}

function busGain(channel: MixChannel, mix: Mix) {
  if (channel.muted) return 0;
  if ((mix.stems.solo || mix.click.solo || mix.cues.solo) && !channel.solo) return 0;
  return Math.min(Math.max(channel.level, 0), 1);
}

function layerGain(id: string, mix: Mix, ids: string[]) {
  const bus = busGain(mix.stems, mix);
  if (bus <= 0.001) return 0;
  const channel = mix.layers[id] ?? freshChannel();
  if (channel.muted) return 0;
  if (ids.some((item) => mix.layers[item]?.solo) && !channel.solo) return 0;
  return bus * Math.min(Math.max(channel.level, 0), 1);
}

function TrackRail({
  mix,
  canMix,
  open,
  railRef,
  onToggle,
  onChannel,
}: {
  mix: Mix;
  canMix: boolean;
  open: boolean;
  railRef: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onChannel: (bus: "stems" | "click" | "cues", channel: MixChannel) => void;
}) {
  return (
    <div ref={railRef} className="flex w-[196px] shrink-0 flex-col rounded-l-[14px] bg-background/45" style={{ height: rulerHeight + laneHeight }}>
      <div style={{ height: rulerHeight }} />
      <div className="flex min-h-0 flex-1 flex-col">
        <TrackLane title="Stems" color="#076FBF" channel={mix.stems} onChange={(channel) => onChannel("stems", channel)}>
          <button
            type="button"
            aria-label="Stem tracks"
            aria-pressed={open}
            disabled={!canMix}
            onClick={onToggle}
            className={`grid size-[26px] place-items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${canMix && open ? "bg-primary text-white" : "bg-surface-elevated text-muted"} disabled:text-disabled`}
          >
            <SlidersIcon />
          </button>
        </TrackLane>
        <TrackLane title="Click" color="var(--muted)" channel={mix.click} onChange={(channel) => onChannel("click", channel)} />
        <TrackLane title="Cues" color="#FA8E23" channel={mix.cues} onChange={(channel) => onChannel("cues", channel)} />
      </div>
    </div>
  );
}

function TrackLane({
  title,
  color,
  channel,
  onChange,
  children,
}: {
  title: string;
  color: string;
  channel: MixChannel;
  onChange: (channel: MixChannel) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 px-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-[22px] w-[3px] shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{title}</span>
        {children}
        <RailToggle label={`Mute ${title}`} mark="M" on={channel.muted} color="#E4372D" onClick={() => onChange({ ...channel, muted: !channel.muted })} />
        <RailToggle label={`Solo ${title}`} mark="S" on={channel.solo} color="#E2B340" onClick={() => onChange({ ...channel, solo: !channel.solo })} />
      </div>
      <MixSlider label={`${title} volume`} value={channel.level} tint={color} onChange={(level) => onChange({ ...channel, level })} />
    </div>
  );
}

function RailToggle({ label, mark, on, color, onClick }: { label: string; mark: string; on: boolean; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={`grid size-[26px] place-items-center rounded-md text-[12px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${on ? "text-white" : "bg-surface-elevated text-muted"}`}
      style={on ? { backgroundColor: color } : undefined}
    >
      {mark}
    </button>
  );
}

function MixSlider({ label, value, tint, onChange }: { label: string; value: number; tint: string; onChange: (value: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  function fromClient(clientX: number) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const travel = Math.max(rect.width - 12, 1);
    onChange(Math.min(1, Math.max(0, (clientX - rect.left - 6) / travel)));
  }
  const travel = `calc((100% - 12px) * ${Math.min(Math.max(value, 0), 1)})`;
  return (
    <div
      ref={ref}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        fromClient(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) fromClient(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") onChange(Math.min(1, value + 0.05));
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") onChange(Math.max(0, value - 0.05));
      }}
      className="relative h-4 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
    >
      <span className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full bg-ink/15" />
      <span className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full" style={{ width: `calc(${travel} + 6px)`, backgroundColor: tint }} />
      <span className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-ink shadow-[0_1px_2px_rgb(0_0_0/0.28)]" style={{ left: travel }} />
    </div>
  );
}

function StemLayerList({
  panelRef,
  layers,
  mix,
  onChannel,
  onDelete,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  layers: StemLayer[];
  mix: Mix;
  onChannel: (id: string, channel: MixChannel) => void;
  onDelete: (layer: StemLayer) => Promise<void>;
}) {
  const [pending, setPending] = useState<StemLayer | null>(null);
  const [removing, setRemoving] = useState(false);
  return (
    <div
      ref={panelRef}
      className="absolute z-30 w-[248px] rounded-xl bg-surface-elevated p-3 shadow-[0_8px_24px_rgb(0_0_0/0.28)]"
      style={{ left: 204, top: rulerHeight + 8 }}
    >
      <div className="grid gap-2.5">
        {layers.map((layer) => {
          const channel = mix.layers[layer.id] ?? freshChannel();
          return (
            <div key={layer.id}>
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{layer.name}</span>
                {layer.main ? null : (
                  <button
                    type="button"
                    aria-label={`Delete ${layer.name}`}
                    onClick={() => setPending(layer)}
                    className="grid size-6 place-items-center rounded-md text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="min-w-0 flex-1">
                  <MixSlider
                    label={`${layer.name} volume`}
                    value={channel.level}
                    tint={layer.guide ? "var(--muted)" : "#076FBF"}
                    onChange={(level) => onChannel(layer.id, { ...channel, level })}
                  />
                </div>
                <RailToggle label={`Mute ${layer.name}`} mark="M" on={channel.muted} color="#E4372D" onClick={() => onChannel(layer.id, { ...channel, muted: !channel.muted })} />
                <RailToggle label={`Solo ${layer.name}`} mark="S" on={channel.solo} color="#E2B340" onClick={() => onChannel(layer.id, { ...channel, solo: !channel.solo })} />
              </div>
            </div>
          );
        })}
      </div>
      {pending ? (
        <div className="absolute inset-0 grid content-center rounded-xl bg-surface-elevated p-3">
          <p className="text-[13px] font-semibold text-ink">Delete {pending.name}?</p>
          <p className="mt-1 text-[12px] text-muted">This removes it from the song.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="h-7 rounded-md bg-surface px-2.5 text-[12px] font-semibold text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={() => {
                const layer = pending;
                if (!layer) return;
                setRemoving(true);
                void onDelete(layer).finally(() => {
                  setRemoving(false);
                  setPending(null);
                });
              }}
              className="h-7 rounded-md bg-[#e4372d] px-2.5 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
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

function SlidersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 3.5h11M1.5 7h11M1.5 10.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="4.5" cy="3.5" r="1.35" fill="currentColor" />
      <circle cx="9" cy="7" r="1.35" fill="currentColor" />
      <circle cx="6" cy="10.5" r="1.35" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2.2 3.4h8.6M5 3.4V2.4h3v1M3.2 3.4l.5 7.2h5.6l.5-7.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
