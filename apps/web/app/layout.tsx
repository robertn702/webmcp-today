import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@/components/auth/user/user-button";
import { DesktopNavLinks } from "@/components/desktop-nav";
import { MobileNav } from "@/components/mobile-nav";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
// Display face for landing headlines only — an editorial serif against the
// neutral UI sans, which keeps marketing type from looking like app chrome.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "WebMCP Today Beta · MCP tools for any site",
    template: "%s · WebMCP Today",
  },
  description:
    "WebMCP Today is a public beta registry of inspectable WebMCP packages. Install one and your agent can call named, same-origin API tools instead of scraping the page.",
};

// Applies the stored theme before first paint to avoid a flash of the wrong
// mode. Storage key must match STORAGE_KEY in components/theme-toggle.tsx.
const themeScript = `(() => {
  const t = localStorage.getItem("theme");
  const dark =
    t === "dark" ||
    (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable, geistMono.variable, instrumentSerif.variable)}
    >
      <body className="flex min-h-screen flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
            <nav
              aria-label="Main"
              className="mx-auto flex max-w-5xl items-center justify-between gap-x-4 px-4 py-3"
            >
              {/* Wayfinding (menu + logo + links) anchored left; only
                  state-dependent utilities on the right, so the right cluster
                  changing width (avatar ↔ sign-in/sign-up buttons) never
                  shifts the nav. */}
              <div className="flex items-center gap-2">
                <MobileNav />
                <Link
                  href="/"
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap font-mono text-lg font-bold"
                >
                  <span>⚡ webmcp.today</span>
                  <span className="rounded border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.14em] text-brand uppercase">
                    Beta
                  </span>
                </Link>
                <DesktopNavLinks />
              </div>
              {/* One shared gap-2 rhythm across links + utilities so the
                  spacing reads even — each item carries equivalent optical
                  padding (links px-2, ghost icon buttons, avatar p-1). */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <UserButton size="icon" align="end" />
              </div>
            </nav>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
