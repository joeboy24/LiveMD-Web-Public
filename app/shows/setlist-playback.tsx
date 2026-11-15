"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readAudio } from "./actions";
import { makeClickBuffer } from "./click-track";
import { busGain, layerGain } from "./mix";
import { createPitch, loadPitch, pitchLatencySamples } from "./pitch";
import { stemRate } from "./stage";
import { playable, prepareStretch } from "./stretch";
import { cueSpeechPlace } from "./structure";
import type { Song, SongCue } from "./types";

const cueBarSize = 92;

type Mode = "set" | "song";
type Layer = { id: string; key: string; main: boolean };
type Live = { source: AudioBufferSourceNode; gain: GainNode; pitch: AudioWorkletNode | null };
type Spoken = { bar: number; place: number; text: string };
type Clock = {
  songId: string;
  lead: number;
  duration: number;
  origin: number;
  pausedAt: number | null;
  barSeconds: number;
  cues: SongCue[];
  cueGain: number;
};

export function useSetlistPlayback(showId: string, songs: Song[]) {
  const audioRef = useRef<AudioContext | null>(null);
  const cacheRef = useRef(new Map<string, AudioBuffer>());
  const clickCacheRef = useRef(new Map<string, AudioBuffer>());
  const liveRef = useRef<Live[]>([]);
  const spokenRef = useRef<Spoken[]>([]);
  const heardRef = useRef<number | null>(null);
  const songsRef = useRef(songs);
  const modeRef = useRef<Mode | null>(null);
  const tokenRef = useRef(0);
  const playingRef = useRef(false);
  const clockRef = useRef<Clock | null>(null);
  const shownRef = useRef(-1);
  const rafRef = useRef(0);
  const loadRef = useRef<(song: Song, nextMode: Mode, resume: boolean) => Promise<void>>(async () => {});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  songsRef.current = songs;

  function setPlayState(value: boolean) {
    playingRef.current = value;
    setPlaying(value);
  }

  function showProgress(ratio: number) {
    const shown = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
    if (shown === shownRef.current) return;
    shownRef.current = shown;
    setProgress(shown / 100);
  }

  const stopSources = useCallback(() => {
    const live = liveRef.current;
    liveRef.current = [];
    for (const item of live) {
      item.source.onended = null;
      try {
        item.source.stop();
      } catch {
        // The source already finished.
      }
      item.pitch?.disconnect();
      item.gain.disconnect();
    }
  }, []);

  function silenceCues(forget: boolean) {
    window.speechSynthesis?.cancel();
    if (!forget) return;
    spokenRef.current = [];
    heardRef.current = null;
  }

  const halt = useCallback(() => {
    tokenRef.current += 1;
    cancelAnimationFrame(rafRef.current);
    stopSources();
    silenceCues(true);
    clockRef.current = null;
    modeRef.current = null;
    setMode(null);
    setActiveId(null);
    setPlayState(false);
    showProgress(0);
    shownRef.current = -1;
  }, [stopSources]);

  function arm() {
    const context = audioRef.current ?? new AudioContext();
    audioRef.current = context;
    void context.resume();
    return context;
  }

  function follow() {
    const clock = clockRef.current;
    const context = audioRef.current;
    if (!clock || !context || clock.pausedAt != null || !playingRef.current) return;
    const elapsed = context.currentTime - clock.origin;
    showProgress(clock.duration > 0 ? elapsed / clock.duration : 0);
    speakCues(elapsed / clock.barSeconds, clock.cues, clock.cueGain);
    rafRef.current = requestAnimationFrame(follow);
  }

  function speakCues(chart: number, cues: SongCue[], gain: number) {
    const previous = heardRef.current;
    if (previous !== null && chart + 0.08 < previous) {
      spokenRef.current = spokenRef.current.filter((mark) => mark.place < chart - 0.05);
    }
    heardRef.current = chart;
    const synth = window.speechSynthesis;
    if (!synth || gain <= 0.001) {
      if (gain <= 0.001) synth?.cancel();
      return;
    }
    const delta = chart - (previous ?? chart);
    for (const cue of cues) {
      const text = cue.text.trim();
      if (!text) continue;
      const anchor = cue.place ?? Math.max(cue.bar - 1, 0) + 0.35;
      const place = cueSpeechPlace(text, anchor, cueBarSize);
      const crossed = previous !== null && delta > 0 && delta < 1.25 && previous < place && chart >= place;
      const landed = (previous === null || delta < -0.08 || delta >= 1.25) && Math.abs(chart - place) < 0.2;
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

  function finish(token: number, songId: string) {
    if (token !== tokenRef.current || !playingRef.current) return;
    if (modeRef.current !== "set") {
      halt();
      return;
    }
    const list = songsRef.current;
    const index = list.findIndex((song) => song.id === songId);
    const next = list.slice(index + 1).find((song) => song.stemKey);
    if (!next) halt();
    else void loadRef.current(next, "set", false);
  }

  async function load(song: Song, nextMode: Mode, resume: boolean) {
    const context = arm();
    const layers = songLayers(song);
    if (layers.length === 0) return;
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    cancelAnimationFrame(rafRef.current);
    stopSources();
    modeRef.current = nextMode;
    setMode(nextMode);
    setActiveId(song.id);
    const continuing = resume && clockRef.current?.songId === song.id;
    if (!continuing) silenceCues(true);
    const held = continuing ? (clockRef.current?.pausedAt ?? 0) : 0;
    const buffers = await Promise.all(layers.map((layer) => loadBuffer(context, layer.key)));
    if (token !== tokenRef.current || !audioRef.current) return;
    const ready = layers.flatMap((layer, index) => {
      const buffer = buffers[index];
      return buffer ? [{ ...layer, buffer }] : [];
    });
    const main = ready.find((layer) => layer.main);
    if (!main) {
      halt();
      return;
    }
    const playback = Math.max(song.tempo, 1);
    const rate = stemRate(playback, song.stage);
    const lead = (Math.max(song.leadBeats, 0) * 60) / playback;
    const duration = lead + main.buffer.duration / rate;
    const position = Math.min(Math.max(held, 0), duration);
    if (position >= duration - 0.05) {
      finish(token, song.id);
      return;
    }
    const ids = ready.map((layer) => layer.id);
    const into = Math.max(position - lead, 0);
    const delay = Math.max(lead - position, 0);
    const offset = into * rate;
    let pitched = false;
    try {
      await loadPitch(context);
      pitched = true;
    } catch {
      pitched = false;
    }
    await Promise.all(ready.map((layer) => prepareStretch(layer.buffer, rate)));
    if (token !== tokenRef.current || !audioRef.current) return;
    const live: Live[] = [];
    for (const layer of ready) {
      const fileOffset = Math.min(offset, Math.max(layer.buffer.duration - 0.02, 0));
      if (layer.buffer.duration - fileOffset <= 0.02) continue;
      const played = playable(layer.buffer, rate, fileOffset);
      if (played.buffer.duration - played.offset <= 0.02) continue;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const pitch = pitched ? createPitch(context, song.stage.pitch) : null;
      source.buffer = played.buffer;
      gain.gain.value = layerGain(layer.id, song.mix, ids);
      if (pitch) source.connect(pitch);
      else source.connect(gain);
      pitch?.connect(gain);
      gain.connect(context.destination);
      if (layer.main) source.onended = () => finish(token, song.id);
      source.start(context.currentTime + delay, played.offset);
      live.push({ source, gain, pitch });
    }
    const beats = Math.max(song.beatsPerBar, 1);
    const tempo = Math.max(song.tempo, 1);
    const barSeconds = (beats * 60) / tempo;
    const bars = Math.max(song.sections.reduce((sum, section) => sum + Math.max(section.bars, 0), 0), 1);
    const clickKey = `${context.sampleRate}|${bars}|${beats}|${tempo}`;
    const click = clickCacheRef.current.get(clickKey) ?? makeClickBuffer(context, bars, beats, tempo);
    clickCacheRef.current.set(clickKey, click);
    const clickOffset = Math.min(Math.max(position, 0), Math.max(click.duration - 0.02, 0));
    if (click.duration - clickOffset > 0.02) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = click;
      gain.gain.value = busGain(song.mix.click, song.mix);
      if (pitched) {
        const delayNode = context.createDelay(0.2);
        delayNode.delayTime.value = pitchLatencySamples / context.sampleRate;
        source.connect(delayNode);
        delayNode.connect(gain);
      } else source.connect(gain);
      gain.connect(context.destination);
      source.start(context.currentTime, clickOffset);
      live.push({ source, gain, pitch: null });
    }
    if (token !== tokenRef.current) {
      for (const item of live) {
        item.source.onended = null;
        try {
          item.source.stop();
        } catch {
          // The source already finished.
        }
        item.pitch?.disconnect();
        item.gain.disconnect();
      }
      return;
    }
    liveRef.current = live;
    clockRef.current = {
      songId: song.id,
      lead,
      duration,
      origin: context.currentTime - position,
      pausedAt: null,
      barSeconds,
      cues: song.cues,
      cueGain: busGain(song.mix.cues, song.mix),
    };
    setPlayState(true);
    follow();
  }
  loadRef.current = load;

  async function loadBuffer(context: AudioContext, key: string) {
    const cached = cacheRef.current.get(key);
    if (cached) return cached;
    const signed = await readAudio(showId, key);
    if (!("url" in signed) || !signed.url) return null;
    const response = await fetch(signed.url);
    if (!response.ok) return null;
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    cacheRef.current.set(key, buffer);
    return buffer;
  }

  function pause() {
    const clock = clockRef.current;
    const context = audioRef.current;
    if (!clock || !context) return;
    clock.pausedAt = Math.min(Math.max(context.currentTime - clock.origin, 0), clock.duration);
    cancelAnimationFrame(rafRef.current);
    stopSources();
    silenceCues(false);
    setPlayState(false);
  }

  function toggleSet() {
    arm();
    const current = songsRef.current.find((song) => song.id === clockRef.current?.songId);
    if (modeRef.current === "set" && current) {
      if (playingRef.current) pause();
      else void load(current, "set", true);
      return;
    }
    const first = songsRef.current.find((song) => song.stemKey);
    if (first) void load(first, "set", false);
  }

  function toggleSong(songId: string) {
    arm();
    const song = songsRef.current.find((item) => item.id === songId);
    if (!song?.stemKey) return;
    if (modeRef.current === "song" && clockRef.current?.songId === songId) {
      if (playingRef.current) pause();
      else void load(song, "song", true);
      return;
    }
    void load(song, "song", false);
  }

  function stopSong(songId: string) {
    if (clockRef.current?.songId === songId) halt();
  }

  useEffect(() => {
    return () => {
      tokenRef.current += 1;
      cancelAnimationFrame(rafRef.current);
      stopSources();
      window.speechSynthesis?.cancel();
      void audioRef.current?.close();
      audioRef.current = null;
      cacheRef.current.clear();
      clickCacheRef.current.clear();
    };
  }, [showId, stopSources]);

  return {
    activeId,
    playing,
    progress,
    setPlaying: playing && mode === "set",
    canPlay: songs.some((song) => song.stemKey),
    toggleSet,
    stop: halt,
    toggleSong,
    stopSong,
  };
}

function songLayers(song: Song): Layer[] {
  const layers: Layer[] = [];
  if (song.stemKey) layers.push({ id: song.stemKey, key: song.stemKey, main: true });
  for (const key of song.trackKeys) layers.push({ id: key, key, main: false });
  if (song.guideKey) layers.push({ id: `guide:${song.guideKey}`, key: song.guideKey, main: false });
  return layers;
}
