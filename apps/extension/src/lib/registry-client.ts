import { z } from "zod";
import { webMcpConfigSchema, type WebMcpConfig } from "@robertn702/webmcp-cafe-schema";
import { browser } from "wxt/browser";

export const LOOKUP_MESSAGE_TYPE = "webmcp-cafe:lookup-configs";

export interface LookupMessage {
  type: typeof LOOKUP_MESSAGE_TYPE;
  url: string;
}

/** Raw fetch outcome relayed back from the background script. */
export type LookupResponse = { ok: true; body: unknown } | { ok: false };

const lookupBodySchema = z.object({ configs: z.array(webMcpConfigSchema) });

/**
 * Ask the background script to fetch `GET /api/configs/lookup?url=` (it runs
 * the request against the registry's own origin, avoiding page CSP), then
 * validate the response at this boundary. Returns undefined on any failure
 * (network, non-2xx, or schema mismatch) so callers can fall back.
 */
export async function fetchRegistryConfigs(url: string): Promise<WebMcpConfig[] | undefined> {
  let response: unknown;
  try {
    const message: LookupMessage = { type: LOOKUP_MESSAGE_TYPE, url };
    response = await browser.runtime.sendMessage(message);
  } catch {
    return undefined;
  }

  if (typeof response !== "object" || response === null || Reflect.get(response, "ok") !== true) {
    return undefined;
  }

  const parsed = lookupBodySchema.safeParse(Reflect.get(response, "body"));
  if (!parsed.success) {
    console.warn("[webmcp-cafe] Registry lookup response failed validation:", parsed.error.message);
    return undefined;
  }
  return parsed.data.configs;
}
