import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import {
  LOOKUP_MESSAGE_TYPE,
  type LookupMessage,
  type LookupResponse,
} from "../lib/registry-client.js";
import {
  statusMessageSchema,
  statusQuerySchema,
  type PageStatus,
  type StatusResponse,
} from "../lib/status.js";

/** Last reported status per tab, for the popup. In-memory on purpose: a service
 * worker restart loses it and the popup then says "reload the page", while the
 * badge (per-tab browser state) survives independently. */
const tabStatus = new Map<number, PageStatus>();

// Fetches run here (not the content script) so they hit the registry's own
// origin rather than the page's — this sidesteps page CSP `connect-src`
// restrictions entirely instead of relying on host_permissions overriding them.
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (isLookupMessage(message)) {
      void fetchLookup(message.url).then(sendResponse);
      return true;
    }

    const status = statusMessageSchema.safeParse(message);
    if (status.success) {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        tabStatus.set(tabId, status.data.status);
        void applyBadge(tabId, status.data.status);
      }
      return;
    }

    if (statusQuerySchema.safeParse(message).success) {
      void activeTabStatus().then(sendResponse);
      return true;
    }

    return;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabStatus.delete(tabId);
  });
});

function isLookupMessage(value: unknown): value is LookupMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    Reflect.get(value, "type") === LOOKUP_MESSAGE_TYPE
  );
}

async function fetchLookup(url: string): Promise<LookupResponse> {
  const base = import.meta.env.WXT_REGISTRY_API_URL ?? "http://localhost:3000";
  try {
    const response = await fetch(`${base}/api/packages/lookup?url=${encodeURIComponent(url)}`);
    if (!response.ok) return { ok: false };
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false };
  }
}

async function activeTabStatus(): Promise<StatusResponse> {
  const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  const tabId = tabs[0]?.id;
  return { status: (tabId === undefined ? undefined : tabStatus.get(tabId)) ?? null };
}

/** "!" when the WebMCP flag is off on a page we have tools for, the tool count
 * when registration worked, nothing otherwise. */
async function applyBadge(tabId: number, status: PageStatus): Promise<void> {
  const text =
    status.kind === "webmcp-unavailable"
      ? "!"
      : status.kind === "registered" && status.toolNames.length > 0
        ? String(status.toolNames.length)
        : "";
  const color = status.kind === "webmcp-unavailable" ? "#b45309" : "#3f6212";
  try {
    await browser.action.setBadgeText({ tabId, text });
    if (text) await browser.action.setBadgeBackgroundColor({ tabId, color });
  } catch {
    // Tab closed or navigated away mid-update; the next pass will re-report.
  }
}
