import type { Metadata } from "next";
import Script from "next/script";
import { THEME_EVENT, THEME_KEY } from "./theme";
import "./globals.css";

const themeScript = `(function(){try{var key=${JSON.stringify(THEME_KEY)};var media=window.matchMedia("(prefers-color-scheme: dark)");function systemTheme(){return media.matches?"dark":"light"}function stored(){var t=localStorage.getItem(key);return t==="light"||t==="dark"||t==="system"?t:"system"}function signIn(){return location.pathname==="/sign-in"||location.pathname.indexOf("/sign-in/")===0}function paint(){var preference=signIn()?"system":stored();document.documentElement.dataset.theme=preference==="system"?systemTheme():preference;document.documentElement.dataset.themePreference=preference}paint();media.addEventListener("change",function(){if(document.documentElement.dataset.themePreference==="system"||signIn()){paint();window.dispatchEvent(new Event(${JSON.stringify(THEME_EVENT)}))}})}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Live MD",
  description: "Prepare a show for the Live MD player.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background font-sans text-ink antialiased">
        <style>{`
          @font-face {
            font-family: "Live Rounded";
            src: url("/fonts/rounded") format("truetype");
            font-weight: 100 900;
            font-display: swap;
          }
          .lyric-display {
            font-family: "Live Rounded", ui-rounded, "Arial Rounded MT Bold", sans-serif;
          }
        `}</style>
        <Script id="livemd-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
