import type { Metadata } from "next";
import Script from "next/script";
import { SiteHeader } from "./components/site-header";
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
      <body className="min-h-full bg-background font-sans text-ink antialiased">
        <Script id="livemd-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-7">{children}</main>
      </body>
    </html>
  );
}
