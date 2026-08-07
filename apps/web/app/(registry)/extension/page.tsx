import type { Metadata } from "next";
import Link from "next/link";
import { WebMcpReadiness } from "@/components/webmcp-readiness";
import { EXTENSION_RELEASE_URL } from "../docs/content";

export const metadata: Metadata = {
  title: "Get the beta extension",
  description:
    "Download and load the WebMCP Today public beta extension, then check its WebMCP runtime and install a package on a matching page.",
};

export default function ExtensionPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">The extension</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Load the beta extension</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        WebMCP Today is in public beta. The extension is not in a store yet, and its behavior may
        change as the registry and WebMCP platform develop. Download its release ZIP, then load the
        extracted folder into the supported Chromium browser you already use.
      </p>

      <p className="mt-4 border-l-2 border-brand/30 pl-5 text-sm leading-relaxed text-muted-foreground">
        It stores the package versions you approve and registers their tools on matching pages. If
        something breaks, report it in the{" "}
        <a
          href="https://github.com/robertn702/webmcp-today/issues"
          className="text-foreground underline underline-offset-4"
        >
          project&apos;s GitHub issues
        </a>{" "}
        so the beta can improve.
      </p>

      <WebMcpReadiness />

      <ol className="mt-8 flex flex-col gap-5 border-l-2 border-brand/30 pl-5">
        <li>
          <p className="text-sm font-semibold">Download and extract the beta release</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Download the{" "}
            <a
              href={EXTENSION_RELEASE_URL}
              className="text-foreground underline underline-offset-4"
            >
              WebMCP Today extension ZIP
            </a>{" "}
            and extract it to a folder you can keep. The browser loads that extracted folder
            directly.
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Load the extracted folder</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Open your browser&apos;s extensions page, enable Developer mode, choose Load unpacked,
            and select the extracted folder. Download and extract a new release, then reload that
            folder when you update it. The browser may show a developer-mode warning at launch.
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Confirm the extension answers</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Return to the readiness check above. It probes the extension through its own bridge API
            instead of assuming support from the browser name. No WebMCP testing flag is needed for
            this path: the extension&apos;s built-in fallback registers tools without it. The flag
            only matters for Chrome&apos;s native agent.
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Install a package in the browser</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Open a matching site, click the extension icon, inspect the suggested package, and click
            Install. The visible browser confirmation is deliberate; installed tools update the open
            matching tab without needing a refresh.
          </p>
        </li>
      </ol>

      <p className="mt-10 text-sm text-muted-foreground">
        Continue to the{" "}
        <Link href="/docs/quickstart" className="text-foreground underline underline-offset-4">
          bridge quickstart
        </Link>{" "}
        to install the macOS native host, configure the first-party MCP server, and verify a live
        tool call.
      </p>
    </div>
  );
}
