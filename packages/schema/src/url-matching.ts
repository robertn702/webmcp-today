// URL pattern matching — `:param` dynamic segments and `**` wildcards.
// Ported from Joakim Selemyr's web-mcp-hub (MIT).

export interface MatchResult {
  matched: boolean;
  /** Static segments score 3, dynamic (:param) 2, wildcard (**) 0. */
  score: number;
  params: Record<string, string>;
}

/** "example.com/dashboard/:id" → "/dashboard/:id"; "example.com" → "/". */
export function extractPath(urlPattern: string, domain: string): string {
  let path = urlPattern;
  if (path.toLowerCase().startsWith(domain)) path = path.slice(domain.length);
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

/** Full or partial URL → pathname ("https://a.com/x/y?q=1" → "/x/y"). */
export function normalizeUrlToPath(url: string): string {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url.replace(/^https?:\/\//, "");
    const slashIdx = path.indexOf("/");
    path = slashIdx >= 0 ? path.slice(slashIdx) : "/";
  }
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

const NO_MATCH: MatchResult = { matched: false, score: 0, params: {} };

/**
 * Segment types: static (exact, case-insensitive, +3), `:param` (any single
 * segment, captured, +2), `**` (all remaining segments, must be last, +0).
 * Domain-only patterns always match with score 0. Segment counts must match
 * exactly unless `**` is used.
 */
export function matchUrlPattern(
  urlPattern: string,
  actualUrl: string,
  domain: string,
): MatchResult {
  const patternPath = extractPath(urlPattern, domain);
  const urlPath = normalizeUrlToPath(actualUrl);

  if (patternPath === "/") return { matched: true, score: 0, params: {} };

  const patternSegments = patternPath.split("/").filter(Boolean);
  const urlSegments = urlPath.split("/").filter(Boolean);

  const params: Record<string, string> = {};
  let score = 0;

  for (let i = 0; i < patternSegments.length; i++) {
    const ps = patternSegments[i];
    if (ps === undefined) continue;

    // Wildcard adds no score so exact patterns outrank it at the same depth
    if (ps === "**") return { matched: true, score, params };

    const us = urlSegments[i];
    if (us === undefined) return NO_MATCH;

    if (ps.startsWith(":")) {
      params[ps.slice(1)] = us;
      score += 2;
      continue;
    }
    if (ps.toLowerCase() === us.toLowerCase()) {
      score += 3;
      continue;
    }
    return NO_MATCH;
  }

  if (urlSegments.length > patternSegments.length) return NO_MATCH;
  return { matched: true, score, params };
}

/** Matching configs only, sorted most-specific-first (domain-only last). */
export function rankConfigsByUrl<T extends { urlPattern: string }>(
  configs: T[],
  actualUrl: string,
  domain: string,
): T[] {
  return configs
    .map((config) => ({ config, ...matchUrlPattern(config.urlPattern, actualUrl, domain) }))
    .filter((r) => r.matched)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.config);
}
