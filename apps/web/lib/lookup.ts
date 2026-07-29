import {
  domainLookupKeys,
  rankPackagesByUrl,
  type WebMcpPackage,
} from "@robertn702/webmcp-today-schema";
import { packages } from "@webmcp-today/db";
import { inArray } from "drizzle-orm";
import { db } from "./db";
import { hydratePackages } from "./packages-repo";

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Packages matching a page URL at their latest version, most specific first.
 * Prefilters on `domain` (a lookup index) across the hostname's candidate keys
 * so a package keyed to a registrable domain still serves its own `*.host`
 * urlPattern on subdomains; urlPatterns remain the matching authority.
 */
export async function lookupPackages(url: string): Promise<WebMcpPackage[]> {
  const hostname = hostnameOf(url);
  if (!hostname) return [];
  const rows = await db
    .select()
    .from(packages)
    .where(inArray(packages.domain, domainLookupKeys(hostname)));
  const hydrated = await hydratePackages(rows);
  return rankPackagesByUrl(hydrated, url);
}
