import { createPackageSchema, type CreatePackageInput } from "@robertn702/webmcp-cafe-schema";

import rawMdn from "../data/developer.mozilla.org.json";
import rawWikipedia from "../data/en.wikipedia.org.json";
import rawGithub from "../data/github.com.json";
import rawHackerNews from "../data/news.ycombinator.com.json";
import rawNpm from "../data/npmjs.com.json";
import rawReddit from "../data/reddit.com.json";

// Curated first-party WebMCP packages — the extension's bundled fallback and
// the registry's seed source. Validated once at import; an invalid curated
// file is a build-time bug, so this throws instead of skipping.

function parse(raw: unknown, file: string): CreatePackageInput {
  const parsed = createPackageSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`[webmcp-cafe] Invalid curated package ${file}: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** All curated packages, validated against `createPackageSchema`. */
export const curatedPackages: CreatePackageInput[] = [
  parse(rawGithub, "github.com.json"),
  parse(rawHackerNews, "news.ycombinator.com.json"),
  parse(rawWikipedia, "en.wikipedia.org.json"),
  parse(rawMdn, "developer.mozilla.org.json"),
  parse(rawNpm, "npmjs.com.json"),
  parse(rawReddit, "reddit.com.json"),
];
