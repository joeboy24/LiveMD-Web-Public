"use client";

import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";

type Guide = {
  id: string;
  title: string;
  lead: string;
  steps: { title: string; body: string }[];
};

const guides: Guide[] = [
  {
    id: "sign-in",
    title: "Sign in",
    lead: "Open the player with the seat you were given.",
    steps: [
      {
        title: "Choose how to enter",
        body: "Sign in with email and password, a passkey, or Google. The same account opens every organization that seat belongs to.",
      },
      {
        title: "Accept the seat",
        body: "An invitation links the account to one seat. After you accept, the published shows for that place appear in the app.",
      },
      {
        title: "More than one place",
        body: "Profile lists every organization on the account. Choose one to load its setlists.",
      },
    ],
  },
  {
    id: "setlists",
    title: "Setlists",
    lead: "The Setlists tab is the library for this place.",
    steps: [
      {
        title: "Find a show",
        body: "Recent setlists sit at the top. Published shows are listed below them. Search songs narrows the library.",
      },
      {
        title: "Open the list",
        body: "A setlist shows its date and how many songs it holds. Open it to see the order.",
      },
      {
        title: "Start the set",
        body: "Play begins with the songs already on the device. A list with nothing downloaded yet waits until a song is saved.",
      },
      {
        title: "Add a setlist",
        body: "Seats that can edit see Add setlist. The new list stays with this organization.",
      },
    ],
  },
  {
    id: "songs",
    title: "Songs",
    lead: "A song plays after it is on the device.",
    steps: [
      {
        title: "Download",
        body: "Open the song menu and choose Download. Play stays quiet until that copy is ready.",
      },
      {
        title: "Edit",
        body: "Seats that can edit open Edit song. The sheet holds the title, Track 1, Track 2, Guide/Cues, tempo, key, and lyrics.",
      },
      {
        title: "Remove",
        body: "Remove takes the downloaded song out of the list. Swipe the row, or use the song menu. Undo and Redo sit in the setlist bar.",
      },
    ],
  },
  {
    id: "play",
    title: "Play",
    lead: "The waveform button opens the song that is ready.",
    steps: [
      {
        title: "Where you are",
        body: "The player shows the current section and the bar count inside it. The cue line is the spoken prompt for this moment. Next names the section that follows.",
      },
      {
        title: "The next song",
        body: "When the following song is ready, Play now starts it. Close the card and the set keeps its place.",
      },
      {
        title: "Leave the screen",
        body: "Keep playing in Settings leaves the audio on when you go back or switch tabs. The waveform button pulses while audio is still running.",
      },
      {
        title: "Play the whole list",
        body: "Setlist auto play walks through every song in the open list.",
      },
    ],
  },
  {
    id: "speaker",
    title: "Speaker",
    lead: "Send click, stems, and the guide to the outputs you need.",
    steps: [
      {
        title: "Open Speaker",
        body: "The speaker control opens routing and the mixer. The current output name sits above the choices.",
      },
      {
        title: "Pick an output",
        body: "Click, Stems, and Guide each choose an output. Tap the source, then tap Out 1, Out 2, and the rest of the ports on the interface.",
      },
      {
        title: "Set the mix",
        body: "Mixer has Stems for the performance, Click from the tempo, and Cues for the spoken lines. Master follows the device volume buttons.",
      },
    ],
  },
  {
    id: "arrange",
    title: "Arrange",
    lead: "Owners, music directors, and musicians shape the song. A playback operator plays it.",
    steps: [
      {
        title: "Open Arrangement",
        body: "The song menu includes Arrangement once the song is downloaded. A playback operator does not see it.",
      },
      {
        title: "Sections and cues",
        body: "Mark the sections and place the cues the player will speak. Tempo on the song is what Click follows.",
      },
      {
        title: "Who can publish",
        body: "The owner and the music director publish the show. A musician can arrange. A playback operator plays the published copy.",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    lead: "Three switches sit above Support.",
    steps: [
      {
        title: "Keep playing",
        body: "Audio stays on when you leave the player or switch pages.",
      },
      {
        title: "Setlist auto play",
        body: "The open list continues into the next song on its own.",
      },
      {
        title: "Keep the screen awake",
        body: "The display stays on while a song is open.",
      },
      {
        title: "Support",
        body: "Help opens this page. About and Diagnostic report stay inside the app.",
      },
    ],
  },
];

function matches(guide: Guide, query: string) {
  if (!query) return true;
  const haystack = [guide.title, guide.lead, ...guide.steps.flatMap((step) => [step.title, step.body])].join(" ").toLowerCase();
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

export function HelpGuide() {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(guides[0].id);
  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => guides.filter((guide) => matches(guide, needle)), [needle]);

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!guides.some((guide) => guide.id === id)) return;
    setCurrent(id);
    document.getElementById(id)?.scrollIntoView();
  }, []);

  useEffect(() => {
    const nodes = shown.map((guide) => document.getElementById(guide.id)).filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setCurrent(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.2, 0.6] },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  function open(id: string) {
    setCurrent(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background text-ink">
      <header className="sticky top-0 z-10 border-b border-surface-elevated bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <p className="text-[15px] font-semibold tracking-wide text-primary">Live MD</p>
            <p className="text-[13px] text-muted">Player guide</p>
          </div>
          <label className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3">
            <FiSearch className="shrink-0 text-muted" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the guide"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-disabled"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="grid size-7 place-items-center rounded-full text-muted hover:text-ink" aria-label="Clear search">
                <FiX />
              </button>
            ) : null}
          </label>
          <nav aria-label="Guide" className="flex gap-2 overflow-x-auto pb-1">
            {shown.map((guide) => (
              <button
                key={guide.id}
                type="button"
                onClick={() => open(guide.id)}
                aria-current={current === guide.id ? "true" : undefined}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${current === guide.id ? "bg-primary text-white" : "bg-surface text-muted"}`}
              >
                {guide.title}
              </button>
            ))}
            {shown.length === 0 ? <p className="py-1.5 text-[13px] text-muted">No matching topics.</p> : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        {shown.length === 0 ? (
          <p className="text-[15px] text-muted">Nothing in the player guide matches that search.</p>
        ) : (
          shown.map((guide) => (
            <article key={guide.id} id={guide.id} className="scroll-mt-56 border-b border-surface py-8 first:pt-2 last:border-b-0">
              <h2 className="text-[28px] font-semibold tracking-tight">{guide.title}</h2>
              <p className="mt-2 text-[16px] leading-6 text-muted">{guide.lead}</p>
              <ol className="mt-6 grid gap-5">
                {guide.steps.map((step, index) => (
                  <li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-surface text-[13px] font-semibold text-primary">{index + 1}</span>
                    <div>
                      <h3 className="text-[16px] font-semibold">{step.title}</h3>
                      <p className="mt-1 text-[15px] leading-6 text-muted">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
