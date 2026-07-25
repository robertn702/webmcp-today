import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@/components/auth/user/user-button";
import { Providers } from "@/components/providers";
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
    default: "WebMCP Cafe · MCP tools for any site",
    template: "%s · WebMCP Cafe",
  },
  description:
    "Install community-written MCP tool packages on sites that never shipped any. The extension registers them on the page, so your agent calls named tools instead of guessing.",
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

const navLinkClass = "text-sm text-muted-foreground hover:text-foreground hover:underline";

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
            <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <Link href="/" className="shrink-0 whitespace-nowrap font-mono text-lg font-bold">
                ☕ webmcp.cafe
              </Link>
              <div className="flex items-center gap-4">
                <Link href="/configs" className={navLinkClass}>
                  Browse
                </Link>
                <Link href="/submit" className={navLinkClass}>
                  Submit
                </Link>
                <Link href="/extension" className={navLinkClass}>
                  Extension
                </Link>
                <ThemeToggle />
                <UserButton size="icon" align="end" />
              </div>
            </nav>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
