import { z } from "zod";

// What the content script found on the current page, surfaced on the extension's
// own surfaces (action badge + popup) rather than injected into the page. Kept
// free of `wxt/browser` imports so it stays importable from pure modules and
// tests; the content script sends, the background stores, the popup asks.

/** WebMCP is flag-gated through Chrome 156 and there is no origin-trial path for
 * injected tools (docs/DECISIONS.md 2026-07-24), so every user must set this. */
export const WEBMCP_FLAG_URL = "chrome://flags/#enable-webmcp-testing";

export const STATUS_MESSAGE_TYPE = "webmcp-cafe:page-status";
export const STATUS_QUERY_TYPE = "webmcp-cafe:get-status";

export const pageStatusSchema = z.discriminatedUnion("kind", [
  /** No community config matches this URL — nothing to say, no badge. */
  z.object({ kind: z.literal("no-configs") }),
  /** Configs matched but Chrome exposes no modelContext: the flag is off. */
  z.object({ kind: z.literal("webmcp-unavailable"), configCount: z.number().int().positive() }),
  z.object({ kind: z.literal("registered"), toolNames: z.array(z.string()) }),
]);

export type PageStatus = z.infer<typeof pageStatusSchema>;

/** Content script → background, per registration pass. */
export const statusMessageSchema = z.object({
  type: z.literal(STATUS_MESSAGE_TYPE),
  status: pageStatusSchema,
});

/** Popup → background, asking about the active tab. */
export const statusQuerySchema = z.object({ type: z.literal(STATUS_QUERY_TYPE) });

/** `null` when the background has no status for the tab (e.g. the service
 * worker restarted since the page loaded). */
export const statusResponseSchema = z.object({ status: pageStatusSchema.nullable() });

export type StatusResponse = z.infer<typeof statusResponseSchema>;
