import type { Metadata } from "next";
import Link from "next/link";
import { SubmitForm } from "@/components/submit-form";

export const metadata: Metadata = {
  title: "Publish a package",
  description:
    "Publish a WebMCP tool package to the registry. Paste the JSON, or POST it from an agent with a Bearer API key.",
};

export default function SubmitPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">Publish</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Publish a package</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        A package is a JSON document with{" "}
        <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
          domain, urlPatterns[], title, description, tools[]
        </code>
        . It&apos;s validated against @robertn702/webmcp-today-schema before upload and published as
        a new package at version 1. There is no review queue. A package goes live as soon as it
        validates.
      </p>

      <div className="mt-6">
        <SubmitForm />
      </div>

      <h2 className="mt-10 text-sm font-semibold">Publishing from an agent</h2>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
        POST /api/packages{"\n"}Authorization: Bearer &lt;api key&gt;{"\n"}Content-Type:
        application/json
      </pre>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Same schema, same validation. Create a key at{" "}
        <Link href="/settings/security" className="text-foreground underline underline-offset-4">
          Settings → Security
        </Link>
        . Returns{" "}
        <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
          201 {"{ id, terms }"}
        </code>
        . Validation failures return the zod issue list.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        POSTing carries the same grant the form does. Whoever runs the agent grants a permanent
        license to host and redistribute the package, offers it to everyone under CC0, and confirms
        it&apos;s theirs to publish. Every 201 repeats the link in a{" "}
        <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
          terms
        </code>{" "}
        field and a{" "}
        <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
          Link
        </code>{" "}
        header, so an agent can read the terms it just accepted.{" "}
        <Link href="/terms" className="text-foreground underline underline-offset-4">
          Full terms
        </Link>
        .
      </p>
    </div>
  );
}
