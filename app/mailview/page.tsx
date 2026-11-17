"use client";

import { useSyncExternalStore } from "react";
import { invitationLetter, signInLetter, type Letter } from "../auth/letter";
import { readTheme, THEME_EVENT, type Theme } from "../theme";

const previewUrl = "http://localhost:3000/sign-in/verify?token=preview";

const letters: Letter[] = [
  invitationLetter("UNIXN.ORG", "Musician", previewUrl),
  signInLetter(previewUrl),
];

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function themed(html: string, theme: Theme) {
  return html.replace("<html lang=\"en\">", `<html lang="en" class="theme-${theme}">`);
}

export default function MailViewPage() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as const);
  return (
    <div className="h-full overflow-y-auto pb-10">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted">MAIL</p>
      <h1 className="mt-2 text-[32px] leading-none font-bold tracking-tight text-ink">Mail</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted">Every letter is designed here. Nothing on this page is sent, and each letter follows Appearance.</p>
      <div className="mt-8 grid gap-8">
        {letters.map((letter) => (
          <section key={letter.subject}>
            <p className="text-[13px] font-semibold text-ink">{letter.subject}</p>
            <iframe
              key={`${letter.subject}-${theme}`}
              title={letter.subject}
              srcDoc={themed(letter.html, theme)}
              className="mt-3 h-[680px] w-full rounded-2xl bg-background ring-1 ring-surface-elevated"
            />
          </section>
        ))}
      </div>
    </div>
  );
}
