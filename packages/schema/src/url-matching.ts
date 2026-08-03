// URL pattern matching — Chrome extension `@match` style patterns:
// "<scheme>://<host><path>", e.g. "*://*.wikipedia.org/wiki/*".

import { parse } from "tldts";

export interface ParsedUrlPattern {
  /** "*" (http or https) | "http" | "https" */
  scheme: string;
  /** "*" (any host) | "*.example.com" (subdomains) | "example.com" (exact) */
  host: string;
  /** Always starts with "/"; may contain "*" wildcards. */
  path: string;
}

const URL_PATTERN_RE = /^(\*|https?):\/\/(\*|(?:\*\.)?[^/*]+)(\/.*)$/;
const SPECIAL_USE_SUFFIXES = ["localhost", "local", "test", "invalid", "example", "onion", "arpa"];
const SPECIAL_USE_DOMAINS = ["example.com", "example.net", "example.org"];

export function parseUrlPattern(pattern: string): ParsedUrlPattern | null {
  const match = URL_PATTERN_RE.exec(pattern);
  if (!match) return null;
  const [, scheme, host, path] = match;
  if (scheme === undefined || host === undefined || path === undefined) return null;
  return { scheme: scheme.toLowerCase(), host: host.toLowerCase(), path };
}

/**
 * Is this a concrete host beneath a registrable domain? Public suffixes, IPs,
 * and special-use hosts do not identify one site a package can safely claim.
 * Private PSL entries count: `github.io` must not authorize every GitHub Pages
 * site, while `owner.github.io` is a valid package scope.
 */
export function isRegistrableHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host.endsWith(".")) return false;
  try {
    if (new URL(`https://${host}`).hostname !== host) return false;
  } catch {
    return false;
  }
  const parsed = parse(host, { allowPrivateDomains: true });
  return (
    parsed.domain !== null &&
    (parsed.isIcann === true || parsed.isPrivate === true) &&
    !SPECIAL_USE_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`)) &&
    !SPECIAL_USE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
  );
}

/** True when `hostname` is the declared domain itself or one of its subdomains. */
export function hostnameWithinDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  const scope = domain.toLowerCase();
  return host === scope || host.endsWith(`.${scope}`);
}

/**
 * A registrable package domain may only claim itself or its subdomains. Chrome
 * supports global and public-suffix match patterns, but those scopes do not
 * match the concrete site identity shown to package installers.
 */
export function urlPatternWithinDomain(pattern: string, domain: string): boolean {
  const parsed = parseUrlPattern(pattern);
  if (parsed === null || parsed.host === "*") return false;
  const host = parsed.host.startsWith("*.") ? parsed.host.slice(2) : parsed.host;
  return isRegistrableHostname(domain) && hostnameWithinDomain(host, domain);
}

/** Is every URL pattern constrained to the declared package domain? */
export function urlPatternsWithinDomain(domain: string, urlPatterns: string[]): boolean {
  return urlPatterns.every((pattern) => urlPatternWithinDomain(pattern, domain));
}

export interface MatchResult {
  matched: boolean;
  /** Higher = more specific. Host specificity dominates; path breaks ties. */
  score: number;
}

const NO_MATCH: MatchResult = { matched: false, score: 0 };

/**
 * Does a match-pattern host cover a concrete hostname? `"*"` covers everything;
 * `"*.example.com"` covers `example.com` and any subdomain; otherwise exact.
 * Host coverage only — no scheme/path — used for baseUrl same-origin checks.
 */
export function hostCoversHostname(patternHost: string, hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (patternHost === "*") return true;
  if (patternHost.startsWith("*.")) {
    const base = patternHost.slice(2);
    return host === base || host.endsWith(`.${base}`);
  }
  return patternHost === host;
}

/**
 * Is a package's `domain` lookup key reachable through its own urlPatterns? True
 * when at least one pattern's host covers `domain` (Chrome match semantics:
 * `*.example.com` covers the apex `example.com` too — see hostCoversHostname).
 *
 * A package whose `domain` no pattern covers is unreachable by lookup: on a page
 * that keys on `domain` no pattern matches (dropped by rankPackagesByUrl), and on
 * a page the patterns do cover, `domain` is never a candidate lookup key. Mirrors
 * the baseUrl same-origin check in api.ts. `domain` is expected already
 * normalized (lowercased, www-stripped, as domainSchema emits).
 */
export function domainCoveredByPatterns(domain: string, urlPatterns: string[]): boolean {
  return urlPatterns.some((pattern) => {
    const parsed = parseUrlPattern(pattern);
    return parsed !== null && hostCoversHostname(parsed.host, domain);
  });
}

/**
 * Whether a package document stays inside its visible site scope. Consumers
 * use this to fail closed for data stored before publish-time validation was
 * tightened; schema publication uses the more precise issue paths in package.ts.
 */
export function packageWithinDomainScope(input: {
  domain: string;
  urlPatterns: string[];
  api?: { baseUrl: string };
}): boolean {
  if (
    !isRegistrableHostname(input.domain) ||
    !urlPatternsWithinDomain(input.domain, input.urlPatterns) ||
    !domainCoveredByPatterns(input.domain, input.urlPatterns)
  ) {
    return false;
  }
  if (input.api === undefined) return true;
  try {
    return hostnameWithinDomain(new URL(input.api.baseUrl).hostname, input.domain);
  } catch {
    return false;
  }
}

/**
 * Expand a hostname into the candidate `domain` lookup keys a stored package
 * might use: the full hostname plus each parent domain down to the registrable
 * domain (naively the last two labels — no public-suffix list). Leading `www.`
 * is stripped and the host is lowercased first.
 *
 * `domain` is only a lookup index; urlPatterns are the matching authority
 * (`rankPackagesByUrl`), so over-generating a key at worst misses (no row keyed
 * to it) — it can never mis-serve a package whose patterns don't cover the URL.
 *
 * e.g. "old.reddit.com" → ["old.reddit.com", "reddit.com"].
 */
export function domainLookupKeys(hostname: string): string[] {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const labels = host.split(".");
  const keys: string[] = [];
  // Walk parent suffixes down to the last two labels (naive registrable domain).
  for (let i = 0; i + 2 <= labels.length; i++) {
    keys.push(labels.slice(i).join("."));
  }
  // Single-label hosts (e.g. "localhost") still key on themselves.
  if (keys.length === 0) keys.push(host);
  return keys;
}

function matchHost(patternHost: string, urlHost: string): { matched: boolean; score: number } {
  if (patternHost === "*") return { matched: true, score: 0 };
  const matched = hostCoversHostname(patternHost, urlHost);
  if (patternHost.startsWith("*.")) return { matched, score: matched ? 1 : 0 };
  return { matched, score: 2 };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchPath(patternPath: string, urlPath: string): { matched: boolean; score: number } {
  const regex = new RegExp(`^${patternPath.split("*").map(escapeRegExp).join(".*")}$`);
  if (!regex.test(urlPath)) return { matched: false, score: 0 };
  const wildcardCount = (patternPath.match(/\*/g) ?? []).length;
  return { matched: true, score: patternPath.length - wildcardCount };
}

/** Match a single Chrome-style pattern against a full page URL. */
export function matchUrlPattern(pattern: string, url: string): MatchResult {
  const parsed = parseUrlPattern(pattern);
  if (!parsed) return NO_MATCH;

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NO_MATCH;
  }

  const scheme = target.protocol.replace(/:$/, "");
  if (scheme !== "http" && scheme !== "https") return NO_MATCH;
  if (parsed.scheme !== "*" && parsed.scheme !== scheme) return NO_MATCH;

  const host = matchHost(parsed.host, target.hostname.toLowerCase());
  if (!host.matched) return NO_MATCH;

  const path = matchPath(parsed.path, target.pathname);
  if (!path.matched) return NO_MATCH;

  return { matched: true, score: host.score * 10_000 + path.score };
}

/**
 * Rank items with one or more urlPatterns against a page URL, using each
 * item's best-matching pattern. Non-matching items are dropped; matches sort
 * most-specific-first.
 */
export function rankPackagesByUrl<T extends { urlPatterns: string[] }>(
  items: T[],
  url: string,
): T[] {
  return items
    .map((item) => {
      let best: MatchResult = NO_MATCH;
      for (const pattern of item.urlPatterns) {
        const result = matchUrlPattern(pattern, url);
        if (result.matched && (!best.matched || result.score > best.score)) best = result;
      }
      return { item, ...best };
    })
    .filter((r) => r.matched)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
