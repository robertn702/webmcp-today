# API Research And Safe Replay

Read this reference when the target API is undocumented, browser network inspection is needed, authentication or CSRF is involved, the API origin is uncertain, or a live request will be replayed.

## Research Order

1. Check official developer/API documentation and the site's own public documentation.
2. Inspect the target capability in the browser's Network panel. Filter to `fetch`/XHR and reproduce only harmless read behavior. For writes, inspect requests already captured during a user-initiated action; do not perform a mutation merely to research or test the package.
3. Record only the declarative facts needed for the package: method, origin, path, query, request body kind, response shape, and whether the browser session is required.
4. Separate stable inputs from incidental browser headers. Do not copy telemetry, client hints, tracing IDs, content lengths, generated request IDs, or opaque headers. If the request requires a static header other than generated content type or a value supplied by a declared auth source, the current package format cannot express it; stop rather than certify a browser-only replay.
5. Prefer the smallest endpoint and JMESPath projection that returns the promised fields.

## Origin Decision

- `api.baseUrl` must use HTTPS and stay on the declared package domain or one of its subdomains.
- `urlPatterns` decide where tools register; they do not authorize an unrelated API host.
- Do not use a proxy, redirector, user-supplied URL, or relaxed package domain to evade origin validation.
- The only current unrelated-origin case is Hacker News's anonymous `GET` API at `https://hacker-news.firebaseio.com`. It cannot use declared auth.
- If the required API uses another unrelated origin, explain that the current package format cannot express it and stop rather than fabricate a package.

## Authentication And CSRF

- Primary-origin endpoint and auth-source requests use `credentials: "include"`, but browser policy may still prevent cookie delivery; the Hacker News Firebase exception omits credentials. Require observed authenticated behavior before certifying a replay, and never read, print, store, or paste cookie values.
- Model a token source in `api.auth`: the source names a declared endpoint, uses exactly one of JSON `extract` or raw-text regex `pattern`, and declares `sendAs` as a header, form field, or query parameter.
- Keep `extract` and `errorPath` as locator arrays. They are not JMESPath expressions.
- A form token may attach only to an endpoint with a `form` body.
- Omit `ttlSeconds` unless observed behavior justifies caching. Re-fetching is the safe default.
- Treat every auth-source endpoint as part of the tool's request chain. Do not attach a mutating POST or action GET to a tool marked read-only, and do not replay such a source during testing.
- It is acceptable to validate a declarative write endpoint without invoking it. Never expose the fetched token in notes, logs, fixtures, terminal output, or the final response.

## Exact Read-Only Replay

1. Confirm the chosen request is semantically read-only. Method alone is not proof: vote, unsubscribe, tracking, and action URLs may mutate state through `GET`.
2. Resolve every path and query placeholder with representative values that satisfy the input schema.
3. Include every attached auth-source fetch in the safety and exactness review before replaying the bound endpoint.
4. Show a redacted request summary before execution: method, complete URL, body kind, credential mode, redirect behavior, and generated non-secret headers.
5. Match executor behavior exactly: primary-origin requests use ambient browser credentials; the Hacker News Firebase exception omits credentials; all requests reject redirects. If a request redirects, stop and report it as unsupported.
6. For a primary-origin public `GET` that must be tested logged out, use a clean browser profile or otherwise prove cookies are absent. A credential-free shell request is supplementary evidence, not an exact executor replay.
7. For a logged-in `GET`, run an executor-equivalent page-context fetch in the user's existing browser session with `credentials: "include"`, `redirect: "error"`, and only headers the package can generate. Treat the browser's resend facility as observation only because it may retain unsupported captured headers or follow redirects. Do not export a copied request containing cookies, authorization, CSRF values, or session headers into shell history or chat output.
8. Use only headers the executor can produce: body-derived content type and declared auth-source headers. If another static header is required, stop because the current schema cannot represent it.
9. Do not replay any write, mutating auth source, or ambiguous request. If no safe read chain exists, report that live verification was limited to schema validation and observed network evidence.
10. Compare the response with the proposed `returns` expression. Report a small redacted sample, count, or field summary rather than dumping sensitive or unbounded data.

## Evidence To Report

- Target page and capability.
- Official documentation URL or the browser action used to observe the endpoint.
- Exact redacted read request.
- Whether login is required.
- Concise result and whether the JMESPath projection matches it.
- Assumptions, unstable internal API details, and anything not safely live-tested.
