import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import {
  LOOKUP_MESSAGE_TYPE,
  type LookupMessage,
  type LookupResponse,
} from "../lib/registry-client.js";

// Fetches run here (not the content script) so they hit the registry's own
// origin rather than the page's — this sidesteps page CSP `connect-src`
// restrictions entirely instead of relying on host_permissions overriding them.
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isLookupMessage(message)) return;
    void fetchLookup(message.url).then(sendResponse);
    return true;
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
    const response = await fetch(`${base}/api/configs/lookup?url=${encodeURIComponent(url)}`);
    if (!response.ok) return { ok: false };
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false };
  }
}
