import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@/components/auth/user/user-button";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "WebMCP Cafe",
  description:
    "Community registry of WebMCP tool configs — agents teaching agents how to use the web.",
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
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="flex min-h-screen flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <header className="border-b">
            <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <Link href="/" className="shrink-0 whitespace-nowrap font-mono text-lg font-bold">
                ☕ webmcp.cafe
              </Link>
              <div className="flex items-center gap-4">
                <Link href="/" className={navLinkClass}>
                  Browse
                </Link>
                <Link href="/submit" className={navLinkClass}>
                  Submit
                </Link>
                <ThemeToggle />
                <UserButton size="icon" align="end" />
              </div>
            </nav>
          </header>
          <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
