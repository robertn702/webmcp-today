import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXTENSION_RELEASE_URL } from "./content";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Set up the WebMCP Today extension and local MCP bridge, make a first tool call, or read the package format.",
};

export default function DocsPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">Documentation</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">
        Put a live site tool in your MCP client
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        The first-run path keeps your existing supported Chromium browser. Load the extension,
        connect its local bridge to the first-party MCP server, then make one read-only Reddit call.
      </p>

      <section className="mt-8 rounded-2xl border bg-card p-5">
        <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">Start here</p>
        <h2 className="mt-2 font-display text-2xl tracking-tight">Bridge quickstart</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Check your runtime, install the macOS native host, configure the MCP server, approve the
          Reddit package in the browser, and invoke <code>reddit_subreddit_hot</code>.
        </p>
        <Button
          asChild
          className="mt-5 h-10 gap-2 bg-brand px-4 text-brand-contrast hover:bg-brand/90"
        >
          <Link href="/docs/quickstart">
            Follow the quickstart
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-base font-semibold">Load the extension</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Download the preview ZIP, load its extracted folder, and learn how package installation
            stays explicit and browser-owned.
          </p>
          <a
            href={EXTENSION_RELEASE_URL}
            className="mt-4 inline-flex text-sm font-medium text-foreground underline underline-offset-4"
          >
            Download the extension ZIP
          </a>
          <Link
            href="/extension"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4"
          >
            Extension setup
            <ArrowRight data-icon="inline-end" />
          </Link>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-base font-semibold">Author a package</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Read the data-only package format, API execution model, and validated worked example.
          </p>
          <Link
            href="/docs/package-format"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4"
          >
            Package format
            <ArrowRight data-icon="inline-end" />
          </Link>
        </section>
      </div>
    </div>
  );
}
