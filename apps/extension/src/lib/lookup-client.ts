import { z } from "zod";
import { webMcpPackageSchema } from "@webmcp-today/schema";
import { browser } from "wxt/browser";
import { lookupBlockedSchema } from "./local-lookup.js";

// Content-script side of the page-load lookup. Message plumbing only: the
// background resolves the URL against LOCAL storage (local-lookup.ts) — no
// registry request is ever made on navigation.

export const LOOKUP_MESSAGE_TYPE = "webmcp-today:lookup-packages";

export const lookupMessageSchema = z.object({
  type: z.literal(LOOKUP_MESSAGE_TYPE),
  url: z.string(),
});
export type LookupMessage = z.infer<typeof lookupMessageSchema>;

export const lookupResponseSchema = z.object({
  packages: z.array(webMcpPackageSchema),
  diagnostics: z.object({
    matched: z.number().int().min(0),
    revoked: z.number().int().min(0),
    broken: z.number().int().min(0),
    blocked: lookupBlockedSchema.optional(),
  }),
});
export type LookupResponse = z.infer<typeof lookupResponseSchema>;

/**
 * Ask the background for the installed packages matching `url`, validated at
 * this boundary. Returns undefined only when the background itself is
 * unreachable or answers garbage.
 */
export async function requestLocalLookup(url: string): Promise<LookupResponse | undefined> {
  let response: unknown;
  try {
    const message: LookupMessage = { type: LOOKUP_MESSAGE_TYPE, url };
    response = await browser.runtime.sendMessage(message);
  } catch {
    return undefined;
  }

  const parsed = lookupResponseSchema.safeParse(response);
  if (!parsed.success) {
    console.warn("[webmcp-today] Local lookup response failed validation:", parsed.error.message);
    return undefined;
  }
  return parsed.data;
}
