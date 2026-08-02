"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const pages = [
  { href: "/docs", title: "Documentation", detail: "WebMCP Today overview" },
  { href: "/docs/quickstart", title: "Bridge quickstart", detail: "Make your first live tool call" },
  { href: "/docs/package-format", title: "Package format", detail: "Reference for WebMCP packages" },
];

export function DocsSearch() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const matches = normalizedQuery
    ? pages.filter((page) => `${page.title} ${page.detail}`.toLowerCase().includes(normalizedQuery))
    : [];

  return (
    <div className="relative w-full max-w-xs">
      <label className="sr-only" htmlFor="docs-search">
        Search documentation
      </label>
      <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
      <input
        id="docs-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search docs"
        className="h-9 w-full rounded-md border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {matches.length > 0 ? (
        <div className="absolute top-11 z-50 w-full rounded-lg border bg-popover p-1 shadow-md">
          {matches.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              onClick={() => setQuery("")}
              className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <span className="block font-medium">{page.title}</span>
              <span className="block text-xs text-muted-foreground">{page.detail}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
