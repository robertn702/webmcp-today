import { createPackageSchema, type CreatePackageInput } from "@robertn702/webmcp-cafe-schema";

import rawMdn from "../configs/developer.mozilla.org.json";
import rawWikipedia from "../configs/en.wikipedia.org.json";
import rawGithub from "../configs/github.com.json";
import rawHackerNews from "../configs/news.ycombinator.com.json";
import rawNpm from "../configs/npmjs.com.json";
import rawReddit from "../configs/reddit.com.json";

// Curated first-party WebMCP configs — the extension's bundled fallback and
// the registry's seed source. Validated once at import; an invalid curated
// file is a build-time bug, so this throws instead of skipping.

function parse(raw: unknown, file: string): CreatePackageInput {
  const parsed = createPackageSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`[webmcp-cafe] Invalid curated config ${file}: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** All curated configs, validated against `createPackageSchema`. */
export const definitions: CreatePackageInput[] = [
  parse(rawGithub, "github.com.json"),
  parse(rawHackerNews, "news.ycombinator.com.json"),
  parse(rawWikipedia, "en.wikipedia.org.json"),
  parse(rawMdn, "developer.mozilla.org.json"),
  parse(rawNpm, "npmjs.com.json"),
  parse(rawReddit, "reddit.com.json"),
];
