import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CopyBlock } from "@/components/copy-block";
import {
  CHROME_DEVTOOLS_MCP_PROMPT,
  CREATE_PACKAGE_PROMPT,
  DOWNLOAD_AND_EXTRACT,
  FIRST_TOOL_PROMPT,
  INSTALL_EXTENSION_PROMPT,
  INSTALL_PACKAGE_PROMPT,
  MCP_CONFIG,
  PUBLISH_COMMAND,
  PUBLISH_PACKAGE_PROMPT,
  QUICKSTART_PROMPT,
  START_CHROME,
} from "./content";

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Install the WebMCP Today extension, connect Chrome DevTools MCP, install a package, call a tool, and create a package with an AI coding agent.",
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
          Start here if your coding agent can edit project configuration and use Chrome DevTools
          MCP. It will pause for the browser actions only you can approve.
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
          Load the extracted folder into the Chrome profile from the next step, not your default
          browser profile. Chrome cannot install the ZIP directly.
        </p>
      </Step>

      <Step number="2" title="Start Chrome and load the extension">
        <p>
          Your MCP client and the extension must use the same Chrome profile. This macOS command
          starts a separate Chrome 149+ profile with WebMCP and remote debugging enabled.
        </p>
        <CopyBlock>{START_CHROME}</CopyBlock>
        <p>
          In that new window, open <Code>chrome://extensions</Code>, enable Developer mode, choose
          Load unpacked, and select the extracted folder from step 1. Off-store installs do not
          update automatically, and Chrome may show a developer-mode warning each time it starts. On
          Linux or Windows, launch Chrome with the same three flags. The separate
          <Code>--user-data-dir</Code> is required by current Chrome remote-debugging security.
        </p>
      </Step>

      <Step number="3" title="Connect Chrome DevTools MCP">
        <p>
          Let your coding agent add the server without overwriting the rest of your config, or copy
          the OpenCode example below. The exact outer config key differs by client; the command and
          flags are the important part.
        </p>
        <CopyBlock label="Copy prompt">{CHROME_DEVTOOLS_MCP_PROMPT}</CopyBlock>
        <CopyBlock>{MCP_CONFIG}</CopyBlock>
        <p>
          A working connection exposes <Code>list_webmcp_tools</Code> and
          <Code>execute_webmcp_tool</Code>. If those tools are missing, check that Chrome is running
          on port 9222 and the experimental WebMCP category flag is present.
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
          Give the agent this prompt after Chrome DevTools MCP is connected. A successful run lists
          six Reddit tools and returns live post data without DOM scraping.
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
