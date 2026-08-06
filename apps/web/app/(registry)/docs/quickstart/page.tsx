import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CopyBlock, CopyButton } from "@/components/copy-block";
import { McpClientConfigs } from "@/components/mcp-client-configs";
import { WebMcpReadiness } from "@/components/webmcp-readiness";
import {
  DOWNLOAD_EXTENSION,
  EXTENSION_RELEASE_URL,
  EXTENSION_RELEASES_URL,
  FIRST_TOOL_NAME,
  FIRST_TOOL_PROMPT,
  MCP_BRIDGE_NODE_ISSUE_URL,
  QUICKSTART_PROMPT,
  REDDIT_DEMO_URL,
  REDDIT_TOOL_COUNT,
} from "../content";

export const metadata: Metadata = {
  title: "Bridge quickstart",
  description:
    "Load WebMCP Today in your current Chromium browser, connect the local bridge, install Reddit, and make a read-only tool call.",
};

export default function QuickstartPage() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">
        Bridge quickstart
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl tracking-tight">Make your first live tool call</h1>
        <CopyButton text={QUICKSTART_PROMPT} label="Copy page" />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        This path uses the WebMCP Today extension in your existing supported Chromium browser and a
        local MCP bridge. It keeps package installation and destructive confirmations in the browser
        and does not replace missing tools with browser automation.
      </p>

      <p className="mt-4 border-l-2 border-brand/30 pl-5 text-sm leading-relaxed text-muted-foreground">
        <strong className="font-semibold text-foreground">Before Step 1:</strong> this first-party
        local bridge requires macOS and Chrome or Brave, plus Node 20 or newer for the MCP bridge.
      </p>

      <p className="mt-4 border-l-2 border-brand/30 pl-5 text-sm leading-relaxed text-muted-foreground">
        WebMCP Today is in public beta. The extension, bridge, and package format may change while
        the platform develops. Report a failed step through the{" "}
        <a
          href="https://github.com/robertn702/webmcp-today/issues"
          className="text-foreground underline underline-offset-4"
        >
          project&apos;s GitHub issues
        </a>
        .
      </p>

      <WebMcpReadiness />

      <Step id="load-extension" number="1" title="Load WebMCP Today in your browser">
        <p>
          Download the <a href={EXTENSION_RELEASE_URL}>WebMCP Today extension ZIP</a> and extract
          it. Then open the browser&apos;s extensions page, enable Developer mode,{" "}
          {"choose Load unpacked,"} and select the extracted folder. The extension must remain
          enabled in the same browser that will hold your target tab.
        </p>
        <CopyBlock label="sh">{DOWNLOAD_EXTENSION}</CopyBlock>
        <p>
          Prefer a manual download? Use the{" "}
          <a href={EXTENSION_RELEASES_URL} className="text-foreground underline underline-offset-4">
            latest release on GitHub
          </a>{" "}
          instead.
        </p>
      </Step>

      <Step
        id="configure-mcp-client"
        number="2"
        title="Install the MCP bridge and configure your client"
      >
        <p>
          Add the published MCP bridge to your MCP client with the pinned <Code>npx</Code> command
          below. It downloads the bridge on demand without a global installation; use{" "}
          <Code>npx</Code>
          rather than <Code>bunx</Code> because bridge setup requires Node (see{" "}
          <a
            href={MCP_BRIDGE_NODE_ISSUE_URL}
            className="text-foreground underline underline-offset-4"
          >
            issue #127
          </a>
          ). After restarting the client, ask it to call
          <Code>setup_webmcp_bridge</Code> with <Code>{'{"browser":"chrome","confirm":true}'}</Code>
          (or use <Code>brave</Code>). The confirmation-gated tool copies the durable host and
          writes only this bridge&apos;s per-user native-messaging manifest; it does not expose an
          HTTP service.
        </p>
        <p>
          Select your MCP client, then add the local server without replacing your other MCP
          servers:
        </p>
        <McpClientConfigs />
        <p>
          Restart or reload your MCP client, then call <Code>get_webmcp_bridge_status</Code> after
          setup and continue only when it reports ready. The server exposes{" "}
          <Code>list_connected_webmcp_tabs</Code>, <Code>list_webmcp_tools</Code>, and{" "}
          <Code>execute_webmcp_tool</Code>. The webpage cannot see a native host or MCP client: the
          successful tab-list call is the real handoff check.
        </p>
      </Step>

      <Step
        id="install-reddit-package"
        number="3"
        title="Open Reddit and explicitly install its package"
      >
        <p>
          In your normal browser, open <Code>{REDDIT_DEMO_URL}</Code> and make that tab visible and
          selected. Open the WebMCP Today extension popup, inspect the suggested Reddit package, and
          click Install. This remains a browser-owned consent action; your agent cannot perform it
          for you. The extension registers the package into the already open matching tab.
        </p>
        <p>
          If tools are missing, install or repair the package from the popup and list the tools
          again. Do not substitute DOM scraping or arbitrary page execution for a missing tool.
        </p>
      </Step>

      <Step
        id="make-first-tool-call"
        number="4"
        title="List live tools and make the read-only call"
      >
        <p>
          Ask the MCP client to list connected tabs, then list the tools in the selected Reddit tab.
          A successful installed package contributes {REDDIT_TOOL_COUNT} Reddit tools, including
          <Code>{FIRST_TOOL_NAME}</Code>. Call it with{" "}
          <Code>{'{"subreddit":"webdev","limit":5}'}</Code>, passing the document and tools
          generations returned from the tool-list call.
        </p>
        <CopyBlock>{FIRST_TOOL_PROMPT}</CopyBlock>
        <p>
          <strong className="font-semibold text-foreground">Success:</strong> five current post
          titles and permalinks return from Reddit&apos;s own JSON API. This is generic WebMCP tool
          passthrough: the bridge lists and executes whatever live tools are registered in the
          selected tab. It has no package-only fallback when WebMCP is unavailable.
        </p>
      </Step>

      <section className="mt-10 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Next: create a package</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A first call proves the browser bridge. To add a capability for another site, start with
          the package format and one read-only API tool.
        </p>
        <Link
          href="/docs/package-format"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4"
        >
          Read the package format
          <ArrowRight data-icon="inline-end" />
        </Link>
      </section>
    </div>
  );
}

function Step({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <p className="font-mono text-[11px] tracking-[0.18em] text-brand uppercase">Step {number}</p>
      <h2 id={id} className="scroll-mt-20 mt-2 text-lg font-semibold">
        <a href={`#${id}`} className="hover:underline hover:underline-offset-4">
          {title}
        </a>
      </h2>
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
