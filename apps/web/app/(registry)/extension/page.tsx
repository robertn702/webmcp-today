import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Get the extension — WebMCP Cafe",
  description:
    "The WebMCP Cafe browser extension injects community tool configs into sites that never shipped WebMCP tools.",
};

// TODO(extension): replace this stub with the Chrome Web Store listing (and
// update EXTENSION_HREF in app/page.tsx) once the extension is published.
export default function ExtensionPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">The extension</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Not published yet.</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        The extension is what actually does the work: it looks up configs for the page you&apos;re
        on and registers their tools so an agent can call them. It isn&apos;t on the Chrome Web
        Store yet — until it is, you can run it from source.
      </p>

      <ol className="mt-8 flex flex-col gap-5 border-l-2 border-brand/30 pl-5">
        <li>
          <p className="text-sm font-semibold">Clone and install</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
            git clone https://github.com/robertn702/webmcp-cafe{"\n"}cd webmcp-cafe &amp;&amp; bun
            install
          </pre>
        </li>
        <li>
          <p className="text-sm font-semibold">Run the extension</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
            cd apps/extension &amp;&amp; bun run dev
          </pre>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This launches a separate Chrome profile with the WebMCP features already enabled.
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Turn WebMCP on in your own Chrome</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Chrome 149+, with{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              chrome://flags/#enable-webmcp-testing
            </code>{" "}
            enabled. Sites we inject into don&apos;t serve an origin-trial token on our behalf, so
            the flag is required for end users too.
          </p>
        </li>
      </ol>

      <p className="mt-10 text-sm text-muted-foreground">
        In the meantime,{" "}
        <Link href="/configs" className="text-foreground underline underline-offset-4">
          browse the registry
        </Link>{" "}
        to see what configs exist, or{" "}
        <Link href="/submit" className="text-foreground underline underline-offset-4">
          submit one
        </Link>
        .
      </p>
    </div>
  );
}
