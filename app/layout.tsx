import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { IconRail } from "./components/icon-rail";
import { OrganizationLabel } from "./components/organization-header";
import { SiteHeader } from "./components/site-header";
import { SetlistHistory } from "./shows/history";
import { ShowSidebar } from "./shows/show-sidebar";
import { THEME_KEY } from "./theme";
import "./globals.css";

const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.dataset.theme=t}catch(e){}`;

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
        <SiteHeader buttonName={<OrganizationLabel />} menuName={<OrganizationLabel />} />
        <SetlistHistory>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[300px_minmax(0,3fr)_minmax(180px,1fr)_3.25rem] md:overflow-hidden">
          <aside className="flex min-h-0 w-full min-w-0 flex-col overflow-x-hidden px-4 pt-4 md:h-full md:overflow-hidden md:border-r md:border-surface-elevated md:px-3 md:py-4">
            <Suspense fallback={<p className="text-base text-muted">Loading shows.</p>}>
              <ShowSidebar />
            </Suspense>
          </aside>
          <main className="flex min-h-0 flex-col overflow-y-auto px-4 py-4 md:overflow-hidden md:px-6">{children}</main>
          <aside aria-label="Chat and todos" className="hidden min-h-0 border-l border-surface-elevated md:block" />
          <IconRail />
        </div>
        </SetlistHistory>
      </body>
    </html>
  );
}
