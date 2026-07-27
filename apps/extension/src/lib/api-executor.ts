import { search, type JSONValue } from "@jmespath-community/jmespath";
import type { ApiAuthSource, ApiBlock, ApiEndpoint } from "@robertn702/webmcp-cafe-schema";
import { mcpResult } from "./mcp-result.js";
import type { McpResult } from "./model-context.js";

// Tier-1 "derived-call engine": turns a package's declarative `api` block plus a
// tool's `execution: { mode: "api", endpoint }` into an actual HTTP request,
// performs it, and returns an McpResult. Ships zero package-authored code — it
// only operates on validated package data. See docs/api-execution-model.md.
//
// FETCH CONTEXT: these requests run in the CONTENT SCRIPT (page) context, NOT
// the background service worker. That is deliberate and load-bearing:
//   - The page-context fetch is a *first-party same-site* request to the site's
//     own origin, so it carries ALL of the user's cookies — including
//     `SameSite=Strict`/`Lax` session cookies. That is what lets a tool act as
//     the logged-in user (Reddit's modhash write flow needs exactly this).
//   - A background/service-worker fetch is *cross-site* relative to the site's
//     cookies, so SameSite session cookies would be withheld and authenticated
//     writes would silently fail.
//   - The registry-lookup relay lives in the background because the registry is
//     a *different* origin from the page (page CSP `connect-src` would block
//     it). That reasoning is the opposite of API execution: here the target IS
//     the page's origin, which `connect-src 'self'` and the site's own frontend
//     already permit — so there is no CSP problem to route around.

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;
/** A string that is EXACTLY one placeholder ("{{n}}", not "x{{n}}"). */
const WHOLE_PLACEHOLDER_RE = /^\{\{(\w+)\}\}$/;
const DOCUMENT_REF_RE = /^@documents\/(.+)$/;

export interface DerivedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function stringifyParam(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

/** Interpolate {{param}} into a query/form/body string leaf (raw — the caller's
 *  encoder, e.g. URLSearchParams or JSON.stringify, handles escaping). */
function interpolateString(template: string, params: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) => stringifyParam(params[key]));
}

/** Interpolate {{param}} into a URL path — values are percent-encoded so a
 *  param can never inject a new path segment, query, fragment, or CRLF. */
function interpolatePath(template: string, params: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) =>
    encodeURIComponent(stringifyParam(params[key])),
  );
}

/** Recursively interpolate {{param}} on every string leaf of a body / graphql
 *  variables template; non-string leaves pass through unchanged.
 *
 *  A leaf that is EXACTLY one placeholder emits the RAW TYPED value, so a JSON
 *  body sends `{"count": 10}` rather than `{"count": "10"}` and a GraphQL
 *  `Int!` variable stays an Int. Anything else ("page {{n}}") concatenates as
 *  before. Only bodies need this: `query`/`form`/`path` are schema-typed as
 *  strings and their encoders stringify anyway.
 *
 *  A whole-string placeholder for a param that was not supplied yields
 *  `undefined`, which JSON.stringify drops from an object. That is deliberate —
 *  an absent optional should be absent, not `""`. */
export function interpolateDeep(value: unknown, params: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const whole = WHOLE_PLACEHOLDER_RE.exec(value);
    if (whole !== null) return params[whole[1] ?? ""];
    return interpolateString(value, params);
  }
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, params));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = interpolateDeep(item, params);
    return out;
  }
  return value;
}

/** Walk a locator (object keys + numeric array indices) into a value. Returns
 *  undefined if any segment is missing. Used for `extract` and `errorPath` —
 *  the two reads that must name one place in a document and nothing more, so
 *  they take a segment array and never touch an expression evaluator. */
export function getByPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
    } else if (typeof current === "object") {
      current = Reflect.get(current, segment);
    } else {
      return undefined;
    }
  }
  return current;
}

/** Is there a meaningful value here? Drives errorPath failure detection: an
 *  empty array/string/object (GraphQL's `errors: []`) is NOT an error; a
 *  populated one is. Primitives (number/boolean) count as present. */
export function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/** Apply the endpoint's `returns` JMESPath projection, trimming the response
 *  for density and relevance (output itself is uncapped — docs/DECISIONS.md
 *  2026-07-24).
 *
 *  FAILS LOUDLY, by design. The previous hand-rolled grammar fell back to the
 *  whole response both when it couldn't parse the expression and when the path
 *  matched nothing, which is precisely the silent rot this execution model
 *  exists to replace. Now: a malformed expression or a runtime type error
 *  throws out of `search`, and a projection that resolves to nothing (JMESPath
 *  yields `null`) throws too — that is the API-shape-changed signal. An empty
 *  array is a legitimate "no results" and passes through untouched. */
export function applyProjection(value: JSONValue, returns?: string): JSONValue {
  if (returns === undefined || returns.length === 0) return value;
  const projected = search(value, returns);
  if (projected === null || projected === undefined) {
    throw new Error(
      `Projection "${returns}" matched nothing in the response — the API's shape has probably changed.`,
    );
  }
  return projected;
}

/** Resolve a GraphQL document: `@documents/name` -> the package-level document,
 *  inline documents pass through as-is. */
export function resolveDocument(api: ApiBlock, document: string): string {
  const match = DOCUMENT_REF_RE.exec(document);
  if (!match) return document;
  const name = match[1] ?? "";
  const resolved = api.documents?.[name];
  if (resolved === undefined) {
    throw new Error(`GraphQL document "@documents/${name}" is not defined in api.documents.`);
  }
  return resolved;
}

function assertSameOrigin(url: URL, baseOrigin: string): void {
  if (url.origin !== baseOrigin) {
    throw new Error(
      `Refusing request to ${url.origin} — only same-origin calls to ${baseOrigin} are allowed (api.baseUrl).`,
    );
  }
}

/** Construct the HTTP request for an endpoint from validated tool input. Pure
 *  and synchronous so it is unit-testable; performs the load-bearing
 *  same-origin re-check AFTER binding params. */
export function buildRequest(
  api: ApiBlock,
  endpoint: ApiEndpoint,
  params: Record<string, unknown>,
): DerivedRequest {
  const baseOrigin = new URL(api.baseUrl).origin;
  const url = new URL(interpolatePath(endpoint.path, params), api.baseUrl);
  if (endpoint.query) {
    for (const [key, template] of Object.entries(endpoint.query)) {
      url.searchParams.set(key, interpolateString(template, params));
    }
  }
  // Load-bearing: re-check the fully-resolved origin. A placeholder value or a
  // protocol-relative static path (e.g. "//evil.com/x") cannot smuggle a
  // different origin past this point.
  assertSameOrigin(url, baseOrigin);

  const headers: Record<string, string> = {};
  let body: string | undefined;

  if (endpoint.graphql) {
    if (endpoint.persistedQuery) {
      // TODO(APQ): Automatic Persisted Queries are not implemented. The flow is:
      // send `{ extensions: { persistedQuery: { version: 1, sha256Hash } } }`
      // (hash only) -> on `PersistedQueryNotFound` resend with the full `query`
      // -> cache the hash for subsequent calls. That needs crypto.subtle
      // hashing, retry-on-error detection, and cross-call hash caching — real
      // complexity deferred per the step scope. Fail loud rather than silently
      // sending a full query the package asked to persist.
      throw new Error(
        "persistedQuery (Automatic Persisted Queries) is not yet supported by this executor.",
      );
    }
    const document = resolveDocument(api, endpoint.graphql.document);
    const variables = interpolateDeep(endpoint.graphql.variables ?? {}, params);
    body = JSON.stringify({ query: document, variables });
    headers["content-type"] = "application/json";
  } else if (endpoint.form) {
    const form = new URLSearchParams();
    for (const [key, template] of Object.entries(endpoint.form)) {
      form.set(key, interpolateString(template, params));
    }
    body = form.toString();
    headers["content-type"] = "application/x-www-form-urlencoded;charset=UTF-8";
  } else if (endpoint.body !== undefined) {
    body = JSON.stringify(interpolateDeep(endpoint.body, params));
    headers["content-type"] = "application/json";
  }

  // GET cannot carry a request body.
  if (endpoint.method === "GET") body = undefined;

  return { url: url.toString(), method: endpoint.method, headers, body };
}

interface FetchOutcome {
  status: number;
  ok: boolean;
  text: string;
}

async function performFetch(
  request: DerivedRequest,
  headers: Record<string, string>,
): Promise<FetchOutcome> {
  const response = await fetch(request.url, {
    method: request.method,
    headers,
    body: request.body,
    // First-party same-origin request (enforced in buildRequest): send the
    // user's own cookies so the tool acts as the logged-in user.
    credentials: "include",
  });
  return { status: response.status, ok: response.ok, text: await response.text() };
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

/** Tokens whose source declares `ttlSeconds`, cached ACROSS tool calls — the
 *  per-invocation map only dedupes within a single call, which is why every
 *  Reddit write used to re-fetch the modhash first. A source WITHOUT
 *  `ttlSeconds` is never stored here (Airbyte's default: refresh every
 *  request), so opting in is explicit.
 *
 *  Keyed by origin + source name + the source's own definition so two packages
 *  on one origin that both name a source "csrf" cannot read each other's
 *  token. */
const persistentTokenCache = new Map<string, CachedToken>();

function tokenCacheKey(api: ApiBlock, name: string, source: ApiAuthSource): string {
  return [api.baseUrl, name, source.source.endpoint, ...source.source.extract].join("\u0000");
}

/** Drop every cross-call token. For tests; nothing in production needs it. */
export function clearAuthTokenCache(): void {
  persistentTokenCache.clear();
}

/** Resolve one named auth token source (e.g. Reddit's modhash): fetch its
 *  source endpoint, extract the token via its locator, and return the header to
 *  attach. Two layers of caching — the per-call map (one fetch per source per
 *  tool call, always) and the TTL cache above (only when the source opts in). */
async function resolveAuthToken(
  api: ApiBlock,
  name: string,
  params: Record<string, unknown>,
  cache: Map<string, string>,
): Promise<{ header: string; value: string }> {
  const source = api.auth?.[name];
  if (!source) throw new Error(`Auth source "${name}" is not defined in api.auth.`);
  // `sendAs.in` has exactly one member today; when a second lands this must
  // branch on it instead of assuming a header.
  const header = source.sendAs.name;

  const cached = cache.get(name);
  if (cached !== undefined) return { header, value: cached };

  const ttlMs = source.ttlSeconds === undefined ? 0 : source.ttlSeconds * 1000;
  const key = tokenCacheKey(api, name, source);
  if (ttlMs > 0) {
    const stored = persistentTokenCache.get(key);
    if (stored !== undefined && stored.expiresAt > Date.now()) {
      cache.set(name, stored.value);
      return { header, value: stored.value };
    }
  }

  const sourceEndpoint = api.endpoints[source.source.endpoint];
  if (!sourceEndpoint) {
    throw new Error(
      `Auth source "${name}" fetches from endpoint "${source.source.endpoint}", which is not defined.`,
    );
  }
  const request = buildRequest(api, sourceEndpoint, params);
  const outcome = await performFetch(request, request.headers);
  if (!outcome.ok) {
    throw new Error(`Auth source "${name}" request failed: HTTP ${outcome.status}.`);
  }
  let json: unknown;
  try {
    json = JSON.parse(outcome.text);
  } catch {
    throw new Error(`Auth source "${name}" did not return JSON.`);
  }
  const token = getByPath(json, source.source.extract);
  if (token === undefined || token === null || token === "") {
    throw new Error(
      `Auth source "${name}" yielded no token at "${source.source.extract.join(".")}".`,
    );
  }
  const value = String(token);
  cache.set(name, value);
  if (ttlMs > 0) persistentTokenCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return { header, value };
}

/** JSON.parse returns `any`. This is the one place that narrows it to the
 *  JSONValue the projection engine's types want — sound by construction, since
 *  JSON.parse cannot produce anything else, and it stops the `any` at this
 *  line instead of letting it spread. */
function parseJson(text: string): JSONValue {
  return JSON.parse(text);
}

/** Interpret a completed response: HTTP status, then `errorPath` (GraphQL
 *  200-with-errors default to ["errors"]), then `returns` projection.
 *  Throws on failure so the outer wrapper formats a single error result. */
export function handleResponse(endpoint: ApiEndpoint, outcome: FetchOutcome): McpResult {
  let json: JSONValue | undefined;
  try {
    json = parseJson(outcome.text);
  } catch {
    json = undefined;
  }

  if (json === undefined) {
    if (!outcome.ok) throw new Error(`HTTP ${outcome.status}: ${outcome.text.slice(0, 200)}`);
    return mcpResult(outcome.text);
  }

  if (!outcome.ok) {
    throw new Error(`HTTP ${outcome.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }

  const errorPath = endpoint.errorPath ?? (endpoint.graphql ? ["errors"] : undefined);
  if (errorPath !== undefined) {
    const payload = getByPath(json, errorPath);
    if (isNonEmpty(payload)) {
      throw new Error(
        `API error at "${errorPath.join(".")}": ${JSON.stringify(payload).slice(0, 500)}`,
      );
    }
  }

  const projected = applyProjection(json, endpoint.returns);
  return mcpResult(typeof projected === "string" ? projected : JSON.stringify(projected));
}

export async function executeApiTool(
  toolName: string,
  api: ApiBlock,
  endpointName: string,
  params: Record<string, unknown>,
  annotations?: Record<string, unknown>,
): Promise<McpResult> {
  try {
    return await executeApiToolInner(toolName, api, endpointName, params, annotations);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webmcp-cafe] API tool "${toolName}" failed:`, err);
    return mcpResult(`Error executing "${toolName}": ${msg}`);
  }
}

async function executeApiToolInner(
  toolName: string,
  api: ApiBlock,
  endpointName: string,
  params: Record<string, unknown>,
  annotations?: Record<string, unknown>,
): Promise<McpResult> {
  const endpoint = api.endpoints[endpointName];
  if (!endpoint) throw new Error(`Endpoint "${endpointName}" is not defined in api.endpoints.`);

  // Per-spec courtesy confirm for tools flagged destructive (mirrors the DOM
  // executor). Guarded so the engine stays callable outside a browser (tests).
  if (
    annotations &&
    Reflect.get(annotations, "destructiveHint") === true &&
    typeof window !== "undefined"
  ) {
    if (!window.confirm(`Allow "${toolName}" to call the site API and make changes?`)) {
      return mcpResult(`Tool "${toolName}" cancelled by user.`);
    }
  }

  // Resolve auth token sources first, caching per source-name for this call.
  const tokenCache = new Map<string, string>();
  const authHeaders: Record<string, string> = {};
  for (const authName of endpoint.auth ?? []) {
    const { header, value } = await resolveAuthToken(api, authName, params, tokenCache);
    authHeaders[header] = value;
  }

  const request = buildRequest(api, endpoint, params);
  const outcome = await performFetch(request, { ...request.headers, ...authHeaders });
  return handleResponse(endpoint, outcome);
}
