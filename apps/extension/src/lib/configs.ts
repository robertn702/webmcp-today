import {
  domainLookupKeys,
  rankConfigsByUrl,
  type CreateConfigInput,
} from "@robertn702/webmcp-cafe-schema";
import { definitions } from "@webmcp-cafe/definitions";
import { fetchRegistryConfigs } from "./registry-client.js";

// Curated configs bundled into the extension — used when the registry is
// unreachable or has nothing for the current domain. reddit.com is
// deliberately excluded: on reddit, no log line + no registered tools is the
// signal that the registry lookup failed (see AGENTS.md).
const BUNDLED_DOMAINS = new Set([
  "news.ycombinator.com",
  "github.com",
  "en.wikipedia.org",
  "developer.mozilla.org",
  "npmjs.com",
]);

const bundledConfigs: CreateConfigInput[] = definitions.filter((c) =>
  BUNDLED_DOMAINS.has(c.domain),
);

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Bundled configs whose domain + urlPatterns match the URL, most specific
 * first. Prefilters on the hostname's candidate `domain` keys (registrable
 * domain included) so a `*.host` urlPattern still matches on subdomains;
 * urlPatterns remain the matching authority.
 */
function findBundledConfigsForUrl(url: string): CreateConfigInput[] {
  const hostname = hostnameOf(url);
  if (!hostname) return [];
  const keys = domainLookupKeys(hostname);
  const domainConfigs = bundledConfigs.filter((c) => keys.includes(c.domain));
  return rankConfigsByUrl(domainConfigs, url);
}

/**
 * Configs for the current page: prefer the registry (verified configs for
 * this URL, already ranked server-side), falling back to the bundled curated
 * configs when the fetch fails or the registry has nothing for this
 * domain.
 */
export async function getConfigsForUrl(url: string): Promise<CreateConfigInput[]> {
  const registryConfigs = await fetchRegistryConfigs(url);
  if (registryConfigs && registryConfigs.length > 0) {
    console.info(`[webmcp-cafe] Using ${registryConfigs.length} config(s) from the registry`);
    return registryConfigs;
  }
  const bundled = findBundledConfigsForUrl(url);
  if (bundled.length > 0) {
    console.info(`[webmcp-cafe] Using ${bundled.length} bundled config(s) (registry had none)`);
  }
  return bundled;
}
