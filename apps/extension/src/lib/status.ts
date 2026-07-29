import { z } from "zod";

// What the content script found on the current page, surfaced on the extension's
// own surfaces (action badge + popup) rather than injected into the page. Kept
// free of `wxt/browser` imports so it stays importable from pure modules and
// tests; the content script sends, the background stores, the popup asks.

/** WebMCP is flag-gated through Chrome 156 and there is no origin-trial path for
 * injected tools (docs/DECISIONS.md 2026-07-24), so every user must set this. */
export const WEBMCP_FLAG_URL = "chrome://flags/#enable-webmcp-testing";

export const STATUS_MESSAGE_TYPE = "webmcp-today:page-status";
export const POPUP_STATE_QUERY_TYPE = "webmcp-today:get-popup-state";
export const UNINSTALL_MESSAGE_TYPE = "webmcp-today:uninstall";
export const INSTALL_SUGGESTION_MESSAGE_TYPE = "webmcp-today:install-suggestion";

export const pageStatusSchema = z.discriminatedUnion("kind", [
  /** No installed package matches this URL — nothing to say, no badge. */
  z.object({ kind: z.literal("no-packages") }),
  /** Packages matched but Chrome exposes no modelContext: the flag is off. */
  z.object({ kind: z.literal("webmcp-unavailable"), packageCount: z.number().int().positive() }),
  z.object({ kind: z.literal("registered"), toolNames: z.array(z.string()) }),
  /** The site itself blocks WebMCP (`Permissions-Policy: tools=()`) — distinct
   * from a broken package: nothing this extension holds can register here. */
  z.object({ kind: z.literal("site-blocked"), packageCount: z.number().int().positive() }),
  /** Fail-closed gate: no revocation list has ever been fetched, so installed
   * packages stay paused until the registry's safety list is reachable. */
  z.object({ kind: z.literal("safety-list-missing") }),
  /** Local storage was written by a newer build (or is unreadable) — register
   * nothing until the extension updates. */
  z.object({ kind: z.literal("storage-unreadable") }),
]);

export type PageStatus = z.infer<typeof pageStatusSchema>;

/** Content script → background, per registration pass. `hostname` lets the
 * background and popup talk about the site without re-deriving it. */
export const statusMessageSchema = z.object({
  type: z.literal(STATUS_MESSAGE_TYPE),
  status: pageStatusSchema,
  hostname: z.string(),
});

// ---------------------------------------------------------------------------
// Popup ↔ background

export const popupStateQuerySchema = z.object({ type: z.literal(POPUP_STATE_QUERY_TYPE) });

export const popupInstallSchema = z.object({
  packageId: z.string(),
  title: z.string(),
  version: z.number().int().min(1),
  domain: z.string(),
  state: z.enum(["ok", "revoked", "broken", "engine-too-old"]),
  revokedReason: z.string().optional(),
  /** Absent when the stored body is unreadable (state "broken"). */
  toolCount: z.number().int().min(0).optional(),
  matchesTab: z.boolean(),
});
export type PopupInstall = z.infer<typeof popupInstallSchema>;

/** A registry package offered as a discovery suggestion — real id/versionId,
 * installable through the same bridge path as any other package (no
 * synthetic ids from a bundled fallback). */
export const popupSuggestionSchema = z.object({
  packageId: z.string(),
  versionId: z.string(),
  version: z.number().int().min(1),
  title: z.string(),
  domain: z.string(),
});
export type PopupSuggestion = z.infer<typeof popupSuggestionSchema>;

export const popupStateSchema = z.object({
  /** `null` when the background has no status for the tab (e.g. the service
   * worker restarted since the page loaded). */
  status: pageStatusSchema.nullable(),
  hostname: z.string().nullable(),
  schemaState: z.enum(["ok", "newer", "corrupt"]),
  safetyListPresent: z.boolean(),
  safetyListFetchedAt: z.iso.datetime().optional(),
  installs: z.array(popupInstallSchema),
  /** "index-corrupt": the index key exists but doesn't parse.
   * "installs-vanished": the index is empty though this worker saw installs —
   * eviction/corruption. v1 recovery is manual reinstall from the registry. */
  recovery: z.enum(["index-corrupt", "installs-vanished"]).optional(),
  /** Present only when no installed package matches the current tab — the
   * registry's own `GET /api/packages?pageSize=6`, not a bundled fallback. */
  suggestions: z.array(popupSuggestionSchema).optional(),
  /** True when fetching suggestions failed (offline, registry down) —
   * distinct from an empty `suggestions` array, which means the registry was
   * reached and genuinely has nothing to suggest. */
  suggestionsUnavailable: z.boolean().optional(),
});
export type PopupState = z.infer<typeof popupStateSchema>;

export const uninstallMessageSchema = z.object({
  type: z.literal(UNINSTALL_MESSAGE_TYPE),
  packageId: z.string(),
});
export type UninstallMessage = z.infer<typeof uninstallMessageSchema>;

/** `removed` reflects a re-read of the index, not the uninstall call's own
 * outcome — a thrown uninstall may still have committed its index removal. */
export const uninstallResponseSchema = z.object({ removed: z.boolean() });

/** Popup → background: install one of the suggested packages. The response
 * is `BridgeInstallResponse` (packages/schema/src/bridge.ts) — the popup goes
 * through the identical install-bridge.ts logic as a page-driven install. */
export const installSuggestionMessageSchema = z.object({
  type: z.literal(INSTALL_SUGGESTION_MESSAGE_TYPE),
  packageId: z.string(),
  versionId: z.string(),
});
export type InstallSuggestionMessage = z.infer<typeof installSuggestionMessageSchema>;
