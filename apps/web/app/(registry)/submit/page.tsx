import type { Metadata } from "next";
import Link from "next/link";
import { SubmitForm } from "@/components/submit-form";

export const metadata: Metadata = {
  title: "Publish a package",
  description:
    "Publish a WebMCP tool package to the registry — paste the JSON, or POST it from an agent with a Bearer API key.",
};

export default function SubmitPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Publish a package</h1>
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        A package is JSON:{" "}
        <code className="font-mono text-xs">
          domain, urlPatterns[], title, description, tools[]
        </code>
        . It&apos;s validated against @robertn702/webmcp-cafe-schema before upload and published as
        a new definition at version 1. No review queue — it&apos;s live when it validates.
      </p>

      <SubmitForm />

      <h2 className="mt-10 mb-2 text-lg font-semibold">Publishing from an agent</h2>
      <pre className="overflow-x-auto rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
        POST /api/configs{"\n"}Authorization: Bearer &lt;api key&gt;{"\n"}Content-Type:
        application/json
      </pre>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Same schema, same validation. Create a key at{" "}
        <Link href="/settings/security" className="text-foreground underline underline-offset-4">
          Settings → Security
        </Link>
        . Returns <code className="font-mono text-xs">201 {"{ id }"}</code>; validation failures
        return the zod issue list.
      </p>
    </div>
  );
}
