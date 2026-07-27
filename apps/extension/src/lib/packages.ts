import {
  domainLookupKeys,
  rankPackagesByUrl,
  type CreatePackageInput,
} from "@robertn702/webmcp-cafe-schema";
import { definitions } from "@webmcp-cafe/definitions";
import { fetchRegistryPackages } from "./registry-client.js";

// Curated packages bundled into the extension — used when the registry is
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

const bundledPackages: CreatePackageInput[] = definitions.filter((p) =>
  BUNDLED_DOMAINS.has(p.domain),
);

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Bundled packages whose domain + urlPatterns match the URL, most specific
 * first. Prefilters on the hostname's candidate `domain` keys (registrable
 * domain included) so a `*.host` urlPattern still matches on subdomains;
 * urlPatterns remain the matching authority.
 */
function findBundledPackagesForUrl(url: string): CreatePackageInput[] {
  const hostname = hostnameOf(url);
  if (!hostname) return [];
  const keys = domainLookupKeys(hostname);
  const domainPackages = bundledPackages.filter((p) => keys.includes(p.domain));
  return rankPackagesByUrl(domainPackages, url);
}

/**
 * Packages for the current page: prefer the registry (verified packages for
 * this URL, already ranked server-side), falling back to the bundled curated
 * packages when the fetch fails or the registry has nothing for this
 * domain.
 */
export async function getPackagesForUrl(url: string): Promise<CreatePackageInput[]> {
  const registryPackages = await fetchRegistryPackages(url);
  if (registryPackages && registryPackages.length > 0) {
    console.info(`[webmcp-cafe] Using ${registryPackages.length} package(s) from the registry`);
    return registryPackages;
  }
  const bundled = findBundledPackagesForUrl(url);
  if (bundled.length > 0) {
    console.info(`[webmcp-cafe] Using ${bundled.length} bundled package(s) (registry had none)`);
  }
  return bundled;
}
