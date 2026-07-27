import { browser } from "wxt/browser";
import {
  STATUS_QUERY_TYPE,
  WEBMCP_FLAG_URL,
  statusResponseSchema,
  type PageStatus,
} from "../../lib/status.js";

// The extension's own surface for the one thing every early user has to do:
// turn on chrome://flags/#enable-webmcp-testing. Deliberately not injected into
// the page — banners on third-party sites are user-hostile and a review risk.

const root = document.getElementById("status");
if (root) void render(root);

async function render(root: HTMLElement): Promise<void> {
  root.replaceChildren(...view(await queryStatus()));
}

/** Status for the active tab, or undefined when the background has none. */
async function queryStatus(): Promise<PageStatus | undefined> {
  let response: unknown;
  try {
    response = await browser.runtime.sendMessage({ type: STATUS_QUERY_TYPE });
  } catch {
    return undefined;
  }
  const parsed = statusResponseSchema.safeParse(response);
  return parsed.success ? (parsed.data.status ?? undefined) : undefined;
}

function view(status: PageStatus | undefined): Node[] {
  if (!status) {
    return [
      el("h1", "No status for this tab"),
      el("p", "Reload the page to check it."),
      flagFooter(),
    ];
  }

  if (status.kind === "webmcp-unavailable") {
    const steps = document.createElement("ol");
    steps.append(
      li("Open ", code(WEBMCP_FLAG_URL)),
      li('Set "WebMCP for testing" to Enabled'),
      li("Relaunch Chrome, then reload the page"),
    );
    return [
      el("h1", "WebMCP is turned off in Chrome"),
      el(
        "p",
        `${status.packageCount} package(s) match this page, but Chrome exposes no WebMCP API, so no tools were registered.`,
      ),
      steps,
      el("footer", "Needs Chrome 149 or newer."),
    ];
  }

  if (status.kind === "no-packages") {
    return [
      el("h1", "No tools for this page"),
      el("p", "No community package matches this URL yet."),
      flagFooter(),
    ];
  }

  if (status.toolNames.length === 0) {
    return [
      el("h1", "No tools registered"),
      el("p", "A package matched but every tool was skipped — see the page console for why."),
      flagFooter(),
    ];
  }

  const names = document.createElement("ul");
  names.append(...status.toolNames.map((name) => li("", code(name))));
  return [el("h1", `${status.toolNames.length} tool(s) registered on this page`), names];
}

function flagFooter(): HTMLElement {
  const footer = document.createElement("footer");
  footer.append("WebMCP needs ", code(WEBMCP_FLAG_URL), " (Chrome 149+).");
  return footer;
}

function el(tag: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function li(text: string, ...children: Node[]): HTMLElement {
  const node = document.createElement("li");
  node.append(text, ...children);
  return node;
}

function code(text: string): HTMLElement {
  return el("code", text);
}
