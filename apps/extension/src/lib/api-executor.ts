import type { ApiBlock, ApiEndpoint } from "@robertn702/webmcp-cafe-schema";
import { mcpResult } from "./mcp-result.js";
import type { McpResult } from "./model-context.js";

// Tier-1 "derived-call engine": turns a config's declarative `api` block plus a
// tool's `execution: { mode: "api", endpoint }` into an actual HTTP request,
// performs it, and returns an McpResult. Ships zero config-authored code — it
// only operates on validated config data. See docs/api-execution-model.md.
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
const DOCUMENT_REF_RE = /^@documents\/(.+)$/;
// The tiny `returns` grammar we interpret: dot-separated segments, each either
// `\w+` optionally suffixed with `[]` ("map over this array"), a bare `[]`, or
// a field picker `{a,b,c}` (keep only those keys; maps over arrays). Anything
// richer (wildcards, filters) is NOT interpreted — projection falls back to the
// whole response. Richer projection is a deliberate future decision (docs open
// question "Output projection language").
const PROJECTION_SEGMENT_RE = /^\w+(\[\])?$|^\[\]$|^\{\w+(,\w+)*\}$/;

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
 *  variables template; non-string leaves pass through unchanged. Whole-value
 *  typed substitution ({{n}} -> number) is a known deferred case. */
export function interpolateDeep(value: unknown, params: Record<string, unknown>): unknown {
  if (typeof value === "string") return interpolateString(value, params);
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, params));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = interpolateDeep(item, params);
    return out;
  }
  return value;
}

/** Walk a dot-path (object keys + numeric array indices) into a value. Returns
 *  undefined if any segment is missing. Used for `extract`, `errorPath`, and
 *  single-key projection steps. */
export function getByPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const segment of path.split(".")) {
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

function projectSegments(value: unknown, segments: string[]): unknown {
  if (segments.length === 0) return value;
  const [segment, ...rest] = segments;
  if (segment === undefined) return value;
  if (segment === "[]") {
    if (!Array.isArray(value)) return undefined;
    return value.map((item) => projectSegments(item, rest));
  }
  if (segment.startsWith("{") && segment.endsWith("}")) {
    // Field picker: keep only the named keys. Maps over arrays so
    // "children[].data.{a,b}" works without a trailing bare "[]".
    const keys = segment.slice(1, -1).split(",");
    const pick = (item: unknown): unknown => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined;
      const out: Record<string, unknown> = {};
      for (const key of keys) out[key] = Reflect.get(item, key);
      return projectSegments(out, rest);
    };
    return Array.isArray(value) ? value.map(pick) : pick(value);
  }
  const mapsArray = segment.endsWith("[]");
  const key = mapsArray ? segment.slice(0, -2) : segment;
  const next = getByPath(value, key);
  if (mapsArray) {
    if (!Array.isArray(next)) return undefined;
    return next.map((item) => projectSegments(item, rest));
  }
  return projectSegments(next, rest);
}

/** Apply a `returns` projection to trim output toward the tool-output budget.
 *  SMALLEST useful grammar only (see PROJECTION_SEGMENT_RE); anything outside
 *  it, or a path that resolves to nothing, falls back to the whole response
 *  (truncation then handles size). */
export function applyProjection(value: unknown, returns?: string): unknown {
  if (returns === undefined || returns.length === 0) return value;
  const segments = returns.split(".");
  if (!segments.every((segment) => PROJECTION_SEGMENT_RE.test(segment))) return value;
  const projected = projectSegments(value, segments);
  return projected === undefined ? value : projected;
}

/** Resolve a GraphQL document: `@documents/name` -> the config-level document,
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
      // sending a full query the config asked to persist.
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

/** Resolve one named auth token source (e.g. Reddit's modhash): fetch its
 *  source endpoint, extract the token via the dot-path, and return the header
 *  to attach. Cached by source name so one tool call never fetches the same
 *  source twice. */
async function resolveAuthToken(
  api: ApiBlock,
  name: string,
  params: Record<string, unknown>,
  cache: Map<string, string>,
): Promise<{ header: string; value: string }> {
  const source = api.auth?.[name];
  if (!source) throw new Error(`Auth source "${name}" is not defined in api.auth.`);

  const cached = cache.get(name);
  if (cached !== undefined) return { header: source.sendAs.header, value: cached };

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
    throw new Error(`Auth source "${name}" yielded no token at "${source.source.extract}".`);
  }
  const value = String(token);
  cache.set(name, value);
  return { header: source.sendAs.header, value };
}

/** Interpret a completed response: HTTP status, then `errorPath` (GraphQL
 *  200-with-errors default to "errors"), then `returns` projection + budgeting.
 *  Throws on failure so the outer wrapper formats a single error result. */
export function handleResponse(endpoint: ApiEndpoint, outcome: FetchOutcome): McpResult {
  let json: unknown;
  try {
    json = JSON.parse(outcome.text);
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

  const errorPath = endpoint.errorPath ?? (endpoint.graphql ? "errors" : undefined);
  if (errorPath !== undefined) {
    const payload = getByPath(json, errorPath);
    if (isNonEmpty(payload)) {
      throw new Error(`API error at "${errorPath}": ${JSON.stringify(payload).slice(0, 500)}`);
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
