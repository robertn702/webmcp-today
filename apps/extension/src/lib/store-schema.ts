import { z } from "zod";
import { revocationEntrySchema } from "@webmcp-today/schema";

// Everything the extension persists in chrome.storage.local, and nothing else.
// Pure module — no wxt/browser import — so tests can exercise the real schemas
// and store logic against a fake StorageArea (see storage.ts for the seam).

/** Bump only with a migration story; there is deliberately no migration
 * framework while this is the only version. */
export const STORAGE_SCHEMA_VERSION = 1;

export const SCHEMA_VERSION_KEY = "schemaVersion";
export const INDEX_KEY = "index";
export const REVOKED_KEY = "revoked";
export const DOMAINS_KEY = "domains";
export const PKG_KEY_PREFIX = "pkg:";

/** Key of a stored package body: the served `WebMcpPackage` document verbatim —
 * what's on disk is byte-identical to what the registry served. */
export function pkgKey(packageId: string): string {
  return `${PKG_KEY_PREFIX}${packageId}`;
}

/**
 * The seam over `chrome.storage.local`. Multi-key `set` is atomic on the real
 * platform (one LevelDB WriteBatch: all keys land or none) — fakes must model
 * that, or tests encode a weaker contract than the platform provides.
 */
export interface StorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

/**
 * One installed package, as the page-load match path sees it. Everything a
 * lookup needs lives here so bodies are only loaded for matched survivors.
 */
export const indexEntrySchema = z.object({
  packageId: z.string(),
  versionId: z.string(),
  version: z.number().int().min(1),
  domain: z.string(),
  urlPatterns: z.array(z.string()).min(1),
  title: z.string(),
  minEngine: z.number().int().positive().optional(),
  /** Recognition only ("a surface I already hold") — never a storage key;
   * bodies are stored whole under `pkg:<packageId>`. */
  apiContentHash: z.string().optional(),
  installedAt: z.iso.datetime(),
  source: z.enum(["registry", "suggested"]),
  /** Registry origin the body came from — answers "where do updates for this
   * come from" without guessing. */
  origin: z.string(),
});

/** The install index, keyed by packageId. */
export const indexSchema = z.record(z.string(), indexEntrySchema);

/** The revocation cursor + last-fetched kill list. Its absence is the
 * fail-closed gate: nothing registers until a poll has succeeded once. */
export const revokedDocSchema = z.object({
  cursor: z.number().int().min(0),
  fetchedAt: z.iso.datetime(),
  entries: z.array(revocationEntrySchema),
});

/** The domain-match list: every domain with a published package, for the
 * discovery badge. Its absence just means "never polled yet" — unlike
 * `revoked`, there is no fail-closed gate behind it. */
export const domainsDocSchema = z.object({
  version: z.number().int().min(0),
  generatedAt: z.iso.datetime(),
  fetchedAt: z.iso.datetime(),
  domains: z.array(z.string()),
});

export type IndexEntry = z.infer<typeof indexEntrySchema>;
export type InstallIndex = z.infer<typeof indexSchema>;
export type RevokedDoc = z.infer<typeof revokedDocSchema>;
export type DomainsDoc = z.infer<typeof domainsDocSchema>;
