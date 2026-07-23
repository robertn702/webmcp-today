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

// Spike mode: configs are bundled from the local configs/ dir. Later the
// extension will fetch them from the webmcp.cafe registry API instead.

const allConfigs: CreateConfigInput[] = [
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

/** Configs whose domain + urlPattern match the URL, most specific first. */
export function findConfigsForUrl(url: string): CreateConfigInput[] {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return [];
  }
  const domainConfigs = allConfigs.filter((c) => c.domain === hostname);
  return rankConfigsByUrl(domainConfigs, url, hostname);
}
