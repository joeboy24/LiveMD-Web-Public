"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readAudio } from "./actions";
import type { Song } from "./types";

export function useSetlistPlayback(showId: string, songs: Song[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const songsRef = useRef(songs);
  const modeRef = useRef<"set" | "song" | null>(null);
  const tokenRef = useRef(0);
  const playingRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<"set" | "song" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  songsRef.current = songs;

  function setPlayState(value: boolean) {
    playingRef.current = value;
    setPlaying(value);
  }

  const halt = useCallback(() => {
    tokenRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    modeRef.current = null;
    setMode(null);
    setActiveId(null);
    setPlayState(false);
    setProgress(0);
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    const onTime = () => {
      const duration = audio.duration;
      setProgress(Number.isFinite(duration) && duration > 0 ? audio.currentTime / duration : 0);
    };
    const onEnded = () => {
      if (modeRef.current !== "set") {
        halt();
        return;
      }
      const list = songsRef.current;
      const index = list.findIndex((song) => song.id === audio.dataset.song);
      const next = list.slice(index + 1).find((song) => song.stemKey);
      if (!next) halt();
      else void load(next, "set", false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      tokenRef.current += 1;
      audio.pause();
      audio.removeAttribute("src");
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [showId]);

  async function load(song: Song, nextMode: "set" | "song", resume: boolean) {
    const audio = audioRef.current;
    if (!audio || !song.stemKey) return;
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    modeRef.current = nextMode;
    setMode(nextMode);
    setActiveId(song.id);
    if (audio.dataset.song === song.id && audio.src) {
      if (!resume) {
        audio.currentTime = 0;
        setProgress(0);
      }
    } else {
      const signed = await readAudio(showId, song.stemKey);
      if (token !== tokenRef.current || !audioRef.current) return;
      if (!signed.url) return;
      audio.dataset.song = song.id;
      audio.src = signed.url;
      setProgress(0);
    }
    try {
      await audio.play();
    } catch {
      if (token === tokenRef.current) setPlayState(false);
      return;
    }
    if (token !== tokenRef.current) {
      audio.pause();
      return;
    }
    setPlayState(true);
  }

  function pause() {
    audioRef.current?.pause();
    setPlayState(false);
  }

  function toggleSet() {
    const current = songsRef.current.find((song) => song.id === audioRef.current?.dataset.song);
    if (modeRef.current === "set" && current) {
      if (playingRef.current) pause();
      else void load(current, "set", true);
      return;
    }
    const first = songsRef.current.find((song) => song.stemKey);
    if (first) void load(first, "set", false);
  }

  function toggleSong(songId: string) {
    const song = songsRef.current.find((item) => item.id === songId);
    if (!song?.stemKey) return;
    if (modeRef.current === "song" && audioRef.current?.dataset.song === songId) {
      if (playingRef.current) pause();
      else void load(song, "song", true);
      return;
    }
    void load(song, "song", false);
  }

  function stopSong(songId: string) {
    if (audioRef.current?.dataset.song === songId) halt();
  }

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
