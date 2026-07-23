import {
  createConfigSchema,
  rankConfigsByUrl,
  type CreateConfigInput,
} from "@robertn702/webmcp-cafe-schema";
import rawGithub from "../../configs/github.com.json";
import rawHackerNews from "../../configs/news.ycombinator.com.json";
import rawMdn from "../../configs/developer.mozilla.org.json";
import rawNpm from "../../configs/npmjs.com.json";
import rawWikipedia from "../../configs/en.wikipedia.org.json";
import { fetchRegistryConfigs } from "./registry-client.js";

// Configs bundled from the local configs/ dir — used when the registry is
// unreachable or has nothing for the current domain.

const bundledConfigs: CreateConfigInput[] = [
  rawHackerNews,
  rawGithub,
  rawWikipedia,
  rawMdn,
  rawNpm,
].flatMap((raw) => {
  const parsed = createConfigSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[webmcp-cafe] Invalid bundled config, skipping:", parsed.error.message);
    return [];
  }
  return [parsed.data];
});

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Bundled configs whose domain + urlPattern match the URL, most specific first. */
function findBundledConfigsForUrl(url: string): CreateConfigInput[] {
  const hostname = hostnameOf(url);
  if (!hostname) return [];
  const domainConfigs = bundledConfigs.filter((c) => c.domain === hostname);
  return rankConfigsByUrl(domainConfigs, url, hostname);
}

/**
 * Configs for the current page: prefer the registry (verified configs for
 * this URL, already ranked server-side), falling back to the bundled
 * configs/ dir when the fetch fails or the registry has nothing for this
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
