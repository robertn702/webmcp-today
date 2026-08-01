import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "@/components/copy-block";

const RELEASE_ZIP_URL =
  "https://github.com/robertn702/webmcp-today/releases/latest/download/webmcp-today-chrome.zip";

const INSTALL_PROMPT = `Install the latest WebMCP Today extension release for me.

Download and extract ${RELEASE_ZIP_URL}.
- Do not clone or build the repository, and do not use a per-commit CI artifact.
- Tell me to open chrome://extensions, enable Developer mode, choose Load unpacked, and select the extracted folder. Chrome cannot install the ZIP directly.
- Tell me that WebMCP requires Chrome 149+ and chrome://flags/#enable-webmcp-testing (or an equivalent --enable-features launch flag).
- Remind me that off-store extensions do not update automatically and Chrome may show a developer-mode warning at launch.
- Wait for me to confirm Chrome loaded it.`;

export const metadata: Metadata = {
  title: "Get the extension",
  description:
    "Download and load the latest WebMCP Today browser extension release, then install a package and register its tools on a matching page.",
};

export default function ExtensionPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">The extension</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Load the preview</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        The extension isn&apos;t in the Chrome Web Store yet, so download the latest signed release
        ZIP, extract it, and load the extracted folder. It stores the package versions you approve
        and registers their tools on matching pages. You need Chrome 149+. The complete browser and
        MCP setup is in the{" "}
        <Link href="/docs" className="text-foreground underline underline-offset-4">
          quickstart
        </Link>
        .
      </p>

      <CopyBlock label="Copy install prompt">{INSTALL_PROMPT}</CopyBlock>

      <ol className="mt-8 flex flex-col gap-5 border-l-2 border-brand/30 pl-5">
        <li>
          <p className="text-sm font-semibold">Download and extract the latest release</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <a href={RELEASE_ZIP_URL} className="text-foreground underline underline-offset-4">
              Download the latest release ZIP
            </a>{" "}
            and extract it to a folder you can keep. Chrome cannot install the ZIP directly; it
            loads the extracted folder. This release has the fixed extension ID required for the
            registry install bridge.
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Load the extracted folder</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              chrome://extensions
            </code>{" "}
            → Developer mode → Load unpacked → select the extracted folder. Off-store installs do
            not update automatically: download and load a newer release yourself. Chrome may also
            show a developer-mode warning each time it starts.
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
            our behalf, so anyone running the extension has to turn it on. If you use the launch
            command in the quickstart instead, its{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              --enable-features
            </code>{" "}
            argument enables the same preview directly.
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Install your first package</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Open{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              reddit.com
            </code>
            , click the extension icon, and inspect the Reddit package under Discover packages.
            Click Install; the tools appear in the open Reddit tab automatically.
          </p>
        </li>
        <li>
          <p className="text-sm font-semibold">Check it worked</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The badge should show{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              6
            </code>{" "}
            for the current Reddit package. The page console also logs{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
              [webmcp-today] 1 installed package(s) matched this URL
            </code>
            .
          </p>
        </li>
      </ol>

      <p className="mt-10 text-sm text-muted-foreground">
        Next, follow the{" "}
        <Link href="/docs" className="text-foreground underline underline-offset-4">
          local WebMCP Today MCP bridge quickstart and make a tool call
        </Link>
        , or{" "}
        <Link href="/packages" className="text-foreground underline underline-offset-4">
          browse the registry
        </Link>{" "}
        to see what packages exist. You can also{" "}
        <Link href="/submit" className="text-foreground underline underline-offset-4">
          publish one
        </Link>
        .
      </p>
    </div>
  );
}
