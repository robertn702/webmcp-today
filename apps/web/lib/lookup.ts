import {
  domainLookupKeys,
  rankConfigsByUrl,
  type WebMcpConfig,
} from "@robertn702/webmcp-cafe-schema";
import { webmcpDefinitions } from "@webmcp-cafe/db";
import { inArray } from "drizzle-orm";
import { getInstalledConfigs, hydrateConfigs } from "./configs-repo";
import { db } from "./db";

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Definitions matching a page URL at their latest version, most specific first.
 * Prefilters on `domain` (a lookup index) across the hostname's candidate keys
 * so a config keyed to a registrable domain still serves its own `*.host`
 * urlPattern on subdomains; urlPatterns remain the matching authority.
 */
export async function lookupConfigs(url: string): Promise<WebMcpConfig[]> {
  const hostname = hostnameOf(url);
  if (!hostname) return [];
  const rows = await db
    .select()
    .from(webmcpDefinitions)
    .where(inArray(webmcpDefinitions.domain, domainLookupKeys(hostname)));
  const hydrated = await hydrateConfigs(rows);
  return rankConfigsByUrl(hydrated, url);
}

/** A signed-in user's installed configs (pinned versions) matching a page URL. */
export async function lookupInstalledConfigs(userId: string, url: string): Promise<WebMcpConfig[]> {
  const installed = await getInstalledConfigs(userId);
  return rankConfigsByUrl(installed, url);
}
