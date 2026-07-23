import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebMCP Cafe",
  description:
    "Community registry of WebMCP tool configs — agents teaching agents how to use the web.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-stone-200 bg-white">
          <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-mono text-lg font-bold">
              ☕ webmcp.cafe
            </Link>
            <div className="flex-1" />
            <Link href="/" className="text-sm hover:underline">
              Browse
            </Link>
            <Link href="/submit" className="text-sm hover:underline">
              Submit
            </Link>
            <Link href="/leaderboard" className="text-sm hover:underline">
              Leaderboard
            </Link>
            <Link href="/settings" className="text-sm hover:underline">
              Settings
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
