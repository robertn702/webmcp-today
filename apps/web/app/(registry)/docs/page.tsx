import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CopyBlock } from "@/components/copy-block";
import {
  BUILD_LOCAL_BRIDGE,
  CREATE_PACKAGE_PROMPT,
  DOWNLOAD_AND_EXTRACT,
  FIRST_TOOL_PROMPT,
  INSTALL_EXTENSION_PROMPT,
  INSTALL_NATIVE_HOST,
  INSTALL_PACKAGE_PROMPT,
  LOCAL_BRIDGE_MCP_PROMPT,
  MCP_CONFIG,
  PUBLISH_COMMAND,
  PUBLISH_PACKAGE_PROMPT,
  QUICKSTART_PROMPT,
} from "./content";

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Install the WebMCP Today extension, configure its local MCP bridge, install a package, call a tool, and create a package with an AI coding agent.",
};

export default function DocsPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">Quickstart</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Make your first tool call</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Start with the path we test: an empty extension store, the Reddit package installed from the
        popup, six tools registered on the page, and a live result from Reddit&apos;s JSON API.
        Setup is manual today, so every handoff below is copyable.
      </p>

      <section className="mt-8 border-l-2 border-brand/30 pl-5">
        <h2 className="text-lg font-semibold">Let an agent run the whole quickstart</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Start here if your coding agent can edit project configuration and use the local WebMCP
          Today MCP bridge. It will pause for the browser actions only you can approve.
        </p>
        <CopyBlock label="Copy quickstart prompt">{QUICKSTART_PROMPT}</CopyBlock>
      </section>

      <Step number="1" title="Download the extension">
        <p>
          The extension isn&apos;t on the Chrome Web Store yet, so the current preview is an
          unpacked release. Give a coding agent this prompt, or download and extract the latest
          release ZIP yourself.
        </p>
        <CopyBlock label="Copy prompt">{INSTALL_EXTENSION_PROMPT}</CopyBlock>
        <CopyBlock>{DOWNLOAD_AND_EXTRACT}</CopyBlock>
        <p>
          Chrome cannot install the ZIP directly. Load its extracted folder in Chrome in the next
          step.
        </p>
      </Step>

      <Step number="2" title="Enable WebMCP and load the extension">
        <p>
          In Chrome 149+, enable <Code>chrome://flags/#enable-webmcp-testing</Code> and restart.
          Then open <Code>chrome://extensions</Code>, enable Developer mode, choose Load unpacked,
          and select the extracted folder from step 1. Off-store installs do not update
          automatically, and Chrome may show a developer-mode warning each time it starts.
        </p>
      </Step>

      <Step number="3" title="Configure the local MCP bridge">
        <p>
          The native host is a macOS development setup. Follow its README, then let your coding
          agent merge the local server into your existing <Code>opencode.json</Code>, or use the
          OpenCode entry below without replacing unrelated configuration.
        </p>
        <CopyBlock>{BUILD_LOCAL_BRIDGE}</CopyBlock>
        <p>
          The explicit extension ID below is for the downloaded release from step 1; the installer
          default is only for the local development extension.
        </p>
        <CopyBlock>{INSTALL_NATIVE_HOST}</CopyBlock>
        <CopyBlock label="Copy prompt">{LOCAL_BRIDGE_MCP_PROMPT}</CopyBlock>
        <CopyBlock>{MCP_CONFIG}</CopyBlock>
        <p>
          A working connection exposes <Code>list_connected_webmcp_tabs</Code>,{" "}
          <Code>list_webmcp_tools</Code>, and <Code>execute_webmcp_tool</Code>. Select a normal
          Chrome tab before using them.
        </p>
      </Step>

      <Step number="4" title="Install the Reddit package">
        <p>
          Open <Code>https://www.reddit.com/r/webdev/</Code>, open the WebMCP Today popup, inspect
          the Reddit suggestion, and click Install. The tools appear in that open Reddit tab
          automatically, with no webmcp.today account required.
        </p>
        <CopyBlock label="Copy prompt">{INSTALL_PACKAGE_PROMPT}</CopyBlock>
      </Step>

      <Step number="5" title="Call the tool">
        <p>
          Give the agent this prompt after the local bridge is connected. A successful run lists six
          Reddit tools and returns live post data without DOM scraping.
        </p>
        <CopyBlock label="Copy prompt">{FIRST_TOOL_PROMPT}</CopyBlock>
      </Step>

      <Step number="6" title="Create a package with an agent">
        <p>
          Give a coding agent the target URL and this instruction. Start with one read-only tool;
          proving one request end to end is more valuable than drafting a large untested package.
        </p>
        <CopyBlock label="Copy prompt">{CREATE_PACKAGE_PROMPT}</CopyBlock>
        <p>
          The full schema and a validated example live in the{" "}
          <Link
            href="/docs/package-format"
            className="text-foreground underline underline-offset-4"
          >
            package format reference
          </Link>
          .
        </p>
      </Step>

      <Step number="7" title="Publish the reviewed package">
        <p>
          Sign in, create an API key under Settings → Security, and save it as
          <Code>WEBMCP_TODAY_API_KEY</Code>. The API accepts the same JSON as the{" "}
          <Link href="/submit" className="text-foreground underline underline-offset-4">
            publish form
          </Link>
          .
        </p>
        <CopyBlock label="Copy prompt">{PUBLISH_PACKAGE_PROMPT}</CopyBlock>
        <CopyBlock>{PUBLISH_COMMAND}</CopyBlock>
        <p>
          A successful publish returns <Code>201</Code>, the package id, a <Code>Location</Code>
          header, and a <Code>Link</Code> header for the terms. Publishing is immediate and accepts
          the{" "}
          <Link href="/terms" className="text-foreground underline underline-offset-4">
            submission terms
          </Link>
          , so inspect the JSON and test its requests before sending it.
        </p>
      </Step>
    </div>
  );
}

function Step({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-10 border-l-2 border-brand/30 pl-5">
      <p className="font-mono text-[11px] tracking-[0.18em] text-brand uppercase">Step {number}</p>
      <h2 className="mt-2 text-lg font-semibold">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="mx-1 rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}
