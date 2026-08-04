import { domainLookupKeys, domainsResponseSchema } from "@webmcp-today/schema";
import {
  DOMAINS_KEY,
  domainsDocSchema,
  type DomainsDoc,
  type StorageArea,
} from "./store-schema.js";

// Domain-match list client. Unlike the revocation list this has no
// fail-closed gate — its only consumer is the discovery badge (a hint, not a
// trust boundary), so a never-fetched or failed poll just means no hint yet,
// and the previous list (if any) is kept rather than cleared.

export const DOMAINS_ALARM = "domains";
/** Daily tick — the registry's domain coverage doesn't change urgently. */
export const DOMAINS_POLL_MINUTES = 1440;

export async function readDomainsDoc(area: StorageArea): Promise<DomainsDoc | undefined> {
  const raw = (await area.get(DOMAINS_KEY))[DOMAINS_KEY];
  if (raw === undefined) return undefined;
  const parsed = domainsDocSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export interface DomainsPollDeps {
  area: StorageArea;
  fetchFn: (url: string) => Promise<Response>;
  /** Registry origin — build-time env for polls (never derived from a page). */
  origin: string;
  now?: () => Date;
}

export type DomainsPollResult = { ok: true; doc: DomainsDoc } | { ok: false };

/** Fetch `GET /api/domains` and replace the stored list. Any failure (network,
 * non-2xx, schema mismatch) leaves the previously stored list untouched. */
export async function pollDomains(deps: DomainsPollDeps): Promise<DomainsPollResult> {
  let raw: unknown;
  try {
    const response = await deps.fetchFn(`${deps.origin}/api/domains`);
    if (!response.ok) return { ok: false };
    raw = await response.json();
  } catch {
    return { ok: false };
  }

  const parsed = domainsResponseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };

  const doc: DomainsDoc = {
    version: parsed.data.version,
    generatedAt: parsed.data.generatedAt,
    fetchedAt: (deps.now?.() ?? new Date()).toISOString(),
    domains: parsed.data.domains,
  };
  await deps.area.set({ [DOMAINS_KEY]: doc });
  return { ok: true, doc };
}

/**
 * True when `hostname`'s lookup keys hit the stored domain set — i.e. the
 * registry has at least one published package for this site. Suffix
 * matching only (via `domainLookupKeys`): "example.com" matches
 * "www.example.com" and any subdomain, never "notexample.com". This is a
 * discovery hint, never the matching authority for installed packages
 * (`match-installed.ts` owns that).
 */
export function isDomainAvailable(doc: DomainsDoc | undefined, hostname: string): boolean {
  if (doc === undefined || doc.domains.length === 0) return false;
  const domainSet = new Set(doc.domains);
  return domainLookupKeys(hostname).some((key) => domainSet.has(key));
}
