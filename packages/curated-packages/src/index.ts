import { createPackageSchema, type CreatePackageInput } from "@robertn702/webmcp-today-schema";

import rawGoogle from "../data/google.com.json";
import rawHackerNews from "../data/news.ycombinator.com.json";
import rawReddit from "../data/reddit.com.json";

// Curated first-party WebMCP packages — the registry's seed source. Validated
// once at import; an invalid curated file is a build-time bug, so this throws
// instead of skipping.

function parse(raw: unknown, file: string): CreatePackageInput {
  const parsed = createPackageSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`[webmcp-today] Invalid curated package ${file}: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** All curated packages, validated against `createPackageSchema`. */
export const curatedPackages: CreatePackageInput[] = [
  parse(rawReddit, "reddit.com.json"),
  parse(rawGoogle, "google.com.json"),
  parse(rawHackerNews, "news.ycombinator.com.json"),
];
