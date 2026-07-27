import {
  domainLookupKeys,
  rankPackagesByUrl,
  type RevocationEntry,
} from "@robertn702/webmcp-cafe-schema";
import type { IndexEntry, InstallIndex } from "./store-schema.js";

// Pure page-load matching over the local install index — no storage, no
// browser. The background resolves every navigation from here; the registry
// is never consulted on page load.

/**
 * Installed packages whose domain + urlPatterns match `url`, most specific
 * first. Prefilters on the hostname's candidate domain keys (registrable
 * domain included) so a `*.host` urlPattern still matches on subdomains;
 * urlPatterns remain the matching authority.
 */
export function matchInstalled(index: InstallIndex, url: string): IndexEntry[] {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return [];
  }
  const keys = domainLookupKeys(hostname);
  const candidates = Object.values(index).filter((entry) => keys.includes(entry.domain));
  return rankPackagesByUrl(candidates, url);
}

/**
 * The revocation covering this install, if any. A null `versionId` revokes
 * the whole package; otherwise only the exact installed version.
 */
export function findRevocation(
  entries: RevocationEntry[],
  install: Pick<IndexEntry, "packageId" | "versionId">,
): RevocationEntry | undefined {
  return entries.find(
    (entry) =>
      entry.packageId === install.packageId &&
      (entry.versionId === null || entry.versionId === install.versionId),
  );
}
