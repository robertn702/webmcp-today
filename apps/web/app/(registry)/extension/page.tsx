import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Get the extension",
  description:
    "Build and load the WebMCP Cafe browser extension from source. It looks up tool packages for the page you're on and registers their tools where an agent can call them.",
};

// TODO(extension): replace this stub with the Chrome Web Store listing (and
// update EXTENSION_HREF in app/page.tsx) once the extension is published.
export default function ExtensionPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">The extension</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Run it from source.</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        It isn&apos;t in the Chrome Web Store yet, so building it yourself is the install. It&apos;s
        the part that does the work. It looks up packages for the page you&apos;re on and registers
        their tools where an agent can call them. You&apos;ll need Bun and Chrome 149+.
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
          <p className="text-sm font-semibold">Build it against the live registry</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs">
            WXT_REGISTRY_API_URL=https://webmcp.cafe bun run build --filter=@webmcp-cafe/extension
          </pre>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            That variable is baked in at build time. Leave it off and the extension looks for a
            registry on localhost:3000, finds nothing, and quietly falls back to its bundled
            packages. It will appear to work while ignoring everything you&apos;ve installed.
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Load it</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              chrome://extensions
            </code>{" "}
            → Developer mode → Load unpacked →{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              apps/extension/.output/chrome-mv3
            </code>
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Turn WebMCP on</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Enable{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              chrome://flags/#enable-webmcp-testing
            </code>{" "}
            and restart. Chrome 149+. Sites we inject into don&apos;t serve an origin-trial token on
            our behalf, so anyone running the extension has to turn it on.
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Check it worked</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Open a page one of your packages matches and look at the page console.{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              [webmcp-cafe] Using N config(s) from the registry
            </code>{" "}
            means the registry is live. A{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              bundled config(s)
            </code>{" "}
            line means step 2 didn&apos;t take.
          </p>
        </li>
      </ol>

      <p className="mt-10 text-sm text-muted-foreground">
        In the meantime,{" "}
        <Link href="/packages" className="text-foreground underline underline-offset-4">
          browse the registry
        </Link>{" "}
        to see what packages exist, or{" "}
        <Link href="/submit" className="text-foreground underline underline-offset-4">
          publish one
        </Link>
        .
      </p>
    </div>
  );
}
