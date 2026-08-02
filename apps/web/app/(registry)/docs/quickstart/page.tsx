import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CopyBlock } from "@/components/copy-block";
import { WebMcpReadiness } from "@/components/webmcp-readiness";
import {
  BUILD_LOCAL_BRIDGE,
  EXTENSION_RELEASE_URL,
  FIRST_TOOL_NAME,
  FIRST_TOOL_PROMPT,
  MCP_CONFIG,
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
      <h1 className="mt-3 font-display text-4xl tracking-tight">Make your first live tool call</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        This path uses the WebMCP Today extension in your existing supported Chromium browser and a
        local MCP bridge. It keeps package installation and destructive confirmations in the browser
        and does not replace missing tools with browser automation.
      </p>

      <WebMcpReadiness />

      <section className="mt-8 border-l-2 border-brand/30 pl-5">
        <h2 className="text-lg font-semibold">Let an agent guide the safe parts</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This prompt keeps configuration additive and pauses for the browser actions only you can
          approve.
        </p>
        <CopyBlock label="Copy quickstart prompt">{QUICKSTART_PROMPT}</CopyBlock>
      </section>

      <Step number="1" title="Load WebMCP Today in the browser you already use">
        <p>
          Download the <a href={EXTENSION_RELEASE_URL}>WebMCP Today extension ZIP</a> and extract
          it. Then open the browser&apos;s extensions page, enable Developer mode,{" "}
          {"choose Load unpacked,"} and select the extracted folder. The extension must remain
          enabled in the same browser that will hold your target tab.
        </p>
        <p>
          Install the Reddit package from its popup rather than relying on a registry-page Install
          button. If the readiness check says either WebMCP API is unavailable, use its copy-only
          settings path, enable WebMCP testing, relaunch, and check again. Do not enable it
          preemptively when the runtime check already passes.
        </p>
      </Step>

      <Step number="2" title="Install the local bridge and configure your MCP client">
        <p>
          The current first-party bridge setup supports macOS Chrome and Brave. Build the local MCP
          package and add it to your MCP client. After restarting the client, ask it to call
          <Code>setup_webmcp_bridge</Code> with <Code>{'{"browser":"chrome","confirm":true}'}</Code>
          (or use <Code>brave</Code>). The confirmation-gated tool copies the durable host and
          writes only this bridge&apos;s per-user native-messaging manifest; it does not expose an
          HTTP service.
        </p>
        <CopyBlock>{BUILD_LOCAL_BRIDGE}</CopyBlock>
        <p>
          Add the local server to your MCP client without replacing its other servers, then restart
          or reload that client. This OpenCode example uses the repository&apos;s built executable;
          change only the absolute checkout path.
        </p>
        <CopyBlock label="Copy OpenCode configuration">{MCP_CONFIG}</CopyBlock>
        <p>
          Call <Code>get_webmcp_bridge_status</Code> after setup, then continue only when it reports
          ready. The server exposes <Code>list_connected_webmcp_tabs</Code>,{" "}
          <Code>list_webmcp_tools</Code>, and <Code>execute_webmcp_tool</Code>. The webpage cannot
          see a native host or MCP client: the successful tab-list call is the real handoff check.
        </p>
      </Step>

      <Step number="3" title="Open Reddit and explicitly install its package">
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

      <Step number="4" title="List live tools and make the read-only call">
        <p>
          Ask the MCP client to list connected tabs, then list the tools in the selected Reddit tab.
          A successful installed package contributes {REDDIT_TOOL_COUNT} Reddit tools, including
          <Code>{FIRST_TOOL_NAME}</Code>. Call it with{" "}
          <Code>{'{"subreddit":"webdev","limit":5}'}</Code>, passing the document and tools
          generations returned from the tool-list call.
        </p>
        <CopyBlock label="Copy first-tool prompt">{FIRST_TOOL_PROMPT}</CopyBlock>
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
