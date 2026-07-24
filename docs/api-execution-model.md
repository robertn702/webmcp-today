# API-Backed Tools — Execution Model Proposal

> Design proposal for review. No code changes yet. Status: **proposed**.
> Related: `SPEC.md` (config format v1), `docs/erd.md` (installs/version pinning),
> `packages/schema/src/` (current DOM-centric execution descriptor).

## Motivation

Config format v1 executes tools by driving the DOM: CSS selectors, form fills, clicks.
That works, but it rots _silently_ — the Wikipedia config broke on day one when the
article DOM changed shape, and nothing about the failure was visible until a human
noticed. Selector rot is the expected failure mode of every DOM-backed config, and the
current model has no way to detect it short of a health canary we haven't built.

Most sites we care about already expose the operation as an HTTP call their own frontend
makes. Executing a tool as a **declared API call** instead of a DOM choreography gives us:

- **Structured output.** JSON responses are what an LLM actually wants to consume —
  no extraction heuristics, no HTML-to-text loss.
- **Loud failures.** A 4xx/5xx, a schema mismatch, or a rotated GraphQL persisted-query
  hash fails immediately and detectably. Selector rot fails quietly; API rot fails loudly.
- **Smaller, stabler configs.** The Reddit API surface changes far less often than
  Reddit's markup.

Flagship target: a **read + write Reddit config** backed by its JSON API — readable
threads, plus posting comments — controllable from a terminal LLM through WebMCP. That
requires authenticated writes, which forces the token-acquisition design below.

DOM execution is not going away. The API model is an _additional_ execution mode for
tools where a known API exists; the DOM steps stay the fallback for sites without one.

## Tiered execution model

Three tiers, in strict order of preference. A config author reaches for the lowest tier
that expresses the tool; the registry's curation bar rises with the tier.

| Tier | What it is                                                                    | Code shipped                         | Network                                | Curation bar           |
| ---- | ----------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------- | ---------------------- |
| 1    | Declarative `api` block — the executor derives and performs the HTTP call     | None (pure data)                     | Executor-mediated, same-origin only    | Normal                 |
| 2    | Scoped script slots — small stringified-JS hooks bound to narrow capabilities | Small string functions, pure compute | Never — slots cannot touch the network | Elevated (code review) |
| 3    | Full `evaluate` — stringified async JS escape hatch                           | Arbitrary async function             | Executor-mediated, same-origin only    | Highest; flagged in UI |

The unifying safety property: **the executor only ever sends requests to the declared
same-origin `baseUrl`.** Tiers 1–2 cannot exfiltrate data at all (tier 2 has no network
access; tier 1 has no code). Tier 3 has network access but only through the executor's
same-origin fetch. Exfiltration from tiers 1–2 is structurally near-impossible — which
is what makes human curation tractable. Reviewers check _what the tool does on the
site_, not whether it leaks data off it.

## Tier 1 — the `api` block

The config declares the site's API surface as data; the executor constructs the request,
performs it, and projects the response. Zero code is shipped.

Sketch of the schema additions (zod to come in `packages/schema`; JSON here for review):

```jsonc
{
  // top-level, next to tools[] — shared across the config's API tools
  "api": {
    "baseUrl": "https://www.reddit.com",
    "auth": {
      "csrf": {
        // fetch this, extract the token, attach it to subsequent calls
        "source": { "endpoint": "me", "extract": "data.modhash" },
        "sendAs": { "header": "X-Modhash" },
      },
    },
    "endpoints": {
      "me": { "method": "GET", "path": "/api/me.json" },
      "subredditHot": {
        "method": "GET",
        "path": "/r/{subreddit}/hot.json",
        "query": { "limit": "{limit}" },
        "returns": "data.children[].data.{title,author,score,num_comments,permalink}",
      },
      "comment": {
        "method": "POST",
        "path": "/api/comment",
        "form": {
          "thing_id": "{thingId}",
          "text": "{text}",
          "api_type": "json",
        },
        "auth": ["csrf"],
        "errorPath": "json.errors",
      },
      "searchGraphql": {
        "method": "POST",
        "path": "/svc/shreddit/graphql",
        "graphql": {
          "document": "@documents/search",
          "variables": { "query": "{query}", "first": 10 },
        },
        "errorPath": "errors",
        "persistedQuery": true,
        "returns": "data.search.{...}",
      },
    },
    "documents": {
      // named static GraphQL documents, referenced as @documents/name.
      // Real captured queries are far too long to inline per-endpoint.
      "search": "query Search($query: String!, $first: Int) { ... }",
    },
  },
}
```

And a tool binds to an endpoint:

```jsonc
{
  "name": "reddit_subreddit_hot",
  "description": "List hot posts in a subreddit.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "subreddit": { "type": "string", "description": "Subreddit name, no r/ prefix" },
      "limit": { "type": "integer", "description": "Max posts (default 25)" },
    },
    "required": ["subreddit"],
  },
  "annotations": { "readOnlyHint": true },
  "execution": { "mode": "api", "endpoint": "subredditHot" },
}
```

Field semantics:

- **`baseUrl`** — hard-enforced same-origin. Must match one of the hosts implied by the
  config's `urlPatterns`; the executor refuses any derived URL whose origin differs.
- **`auth` / token sources** — named credential acquisition flows. The CSRF example:
  GET `/api/me.json`, extract `data.modhash` from the JSON, send as the `X-Modhash`
  header on endpoints listing `auth: ["csrf"]`. Cookies ride along automatically (the
  executor runs in the page's origin, so the user's existing session authenticates).
- **`path` / `query` / `body` / `form`** — `{placeholder}` templates bound from the
  validated tool input (same cross-validation the schema already does for `{{param}}`
  in DOM steps; placeholders may only name `inputSchema` properties).
- **`returns`** — a projection applied to the JSON response to trim output for density
  and relevance. There is no hard output cap in v1 (the 1.5K `TOOL_OUTPUT_MAX` was
  removed — model-dependent; the budget question is deferred, see docs/DECISIONS.md
  2026-07-24), so projection is about signal-to-noise, not fitting a fixed budget.
  Missing from a tool's output? Add or widen the projection.
- **`errorPath`** — where errors live in a 200 response body (e.g. `"errors"` for
  GraphQL's 200-with-errors convention, `"json.errors"` for Reddit's REST API). A
  non-empty value at that path = tool failure, surfaced as an error to the agent.
- **`persistedQuery`** — enables APQ retry (see GraphQL section).
- **`documents`** — config-level named static GraphQL documents; endpoints reference
  them as `@documents/name`. Keeps megabyte-adjacent captured queries out of the
  per-endpoint inline JSON and dedupes documents shared by several endpoints.

Reddit write example — the tool that makes this model worth building:

```jsonc
{
  "name": "reddit_comment",
  "description": "Post a comment on a post or reply to a comment.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "thingId": { "type": "string", "description": "Fullname, e.g. t3_abc123 or t1_def456" },
      "text": { "type": "string", "description": "Comment body (markdown)" },
    },
    "required": ["thingId", "text"],
  },
  "annotations": { "readOnlyHint": false },
  "execution": { "mode": "api", "endpoint": "comment" },
}
```

The contributor never writes code. The modhash dance — the fiddliest part of Reddit
write automation — is expressed entirely in the `auth.csrf` declaration.

## Tier 2 — scoped script slots

Some APIs can't be expressed as static templates: a header must be computed, a body
shaped, a response reduced. Tier 2 adds **small stringified-JS hooks** in three
declared slots. The slot name _is_ the capability — a script's scope determines what
it can do, and all slots are **pure compute: no network, ever**.

| Slot       | Signature                         | Runs when                                                    | Capability rules                                                                          |
| ---------- | --------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `headers`  | `(ctx) => Record<string, string>` | Before the executor sends the request                        | Return value is merged into request headers. No `fetch`/`XHR`/`import`.                   |
| `body`     | `(input, ctx) => unknown`         | When the request body is built                               | Return value becomes the JSON body. Input is the validated tool input. No network tokens. |
| `response` | `(json, ctx) => unknown`          | After a successful response, before the `returns` projection | Return value becomes the tool output (then projected). No network tokens.                 |

`ctx` carries executor-provided context (extracted tokens from `auth` sources, endpoint
metadata) — details to be pinned down when the executor is built.

Enforcement, in two layers (both best-effort, honest about their limits):

1. **Publish-time lint (hard gate):** the registry rejects tier-2 code containing
   `fetch`, `XMLHttpRequest`, `import`, `WebSocket`, etc., rejects anything over the
   size cap (1–2 KB per slot), and rejects minified/obfuscated code (see Trust model).
2. **Executor shadowing (defense in depth):** the executor evaluates slot code with
   those globals shadowed to throwing stubs.

This is **not a true sandbox** — same-realm JS cannot be sandboxed against a determined
author (prototype gadgets, `Function` constructor tricks, global pollution). The lint +
shadowing raises the bar and catches accidents and casual abuse; the _actual_ security
boundary is human curation plus the fact that even a fully malicious tier-2 script
cannot make network calls (the executor never gives it one) and can only corrupt output
for its own tool. ShadowRealm is the future hardening path — see Open questions.

## Tier 3 — full `evaluate`

A stringified async JS escape hatch for the long tail tier 1 + slots can't reach:
request signing, computed multipart payloads, multi-step token dances that don't fit
the `auth` declaration model.

- Executor-mediated: the script receives an executor-provided `request()` that is
  same-origin-enforced — it cannot fetch arbitrary hosts even here.
- **Flagged in the registry UI** (config card + install flow show "contains arbitrary
  code" prominently) and held to the highest curation bar.
- Registered tools from tier-3 configs should set `untrustedContentHint` where output
  is script-shaped.

> **This reverses a prior ground rule.** `AGENTS.md` and `packages/schema/src/steps.ts`
> both record "No `evaluate` step in v1 — arbitrary code execution in the user's
> logged-in page." That rule was written when execution meant _unmediated_ code in the
> page (Joakim's model). The reversal rationale: (1) DOM configs rot silently, pushing
> us toward API execution, and some real APIs need computed requests tier 1 cannot
> express; (2) the executor now mediates all network access behind a same-origin wall,
> which was not part of the original design; (3) installs pin to `version_id`, so a
> malicious update never auto-propagates; (4) curation + prominent code display +
> install-count signal is the Greasyfork model, which has carried a far larger arbitrary-
> code ecosystem for years. Tier 3 is gated behind tiers 1–2 in the build order and
> behind the MV3 spike (below) — it ships last, and only if the spike says it's shippable.

## GraphQL support

To the executor, GraphQL is just POST + a JSON body. Two things make it _first-class_
rather than merely possible:

1. **`errorPath: "errors"`** — GraphQL returns HTTP 200 with an `errors` array on
   failure. Without error-path handling every failure looks like success. With it,
   a 200 + non-empty `errors` is a tool error, surfaced to the agent.
2. **`documents` block** — captured real-world queries (Reddit's shreddit, GitHub's
   app queries) run hundreds of lines. Named static documents referenced as
   `@documents/name` keep configs readable. Variables bind from tool input via the
   same `{placeholder}` templates.

Third, **APQ (Automatic Persisted Queries)** behind `persistedQuery: true`, implemented
_once_ in the executor so no config author ever thinks about it:

```
send { extensions: { persistedQuery: { sha256Hash } } }
  → PersistedQueryNotFound
  → resend { query: <full document>, extensions: { ... } }
  → subsequent calls send hash only
```

Hash rotation on site deploys fails loudly (the server stops recognizing the hash, and
the full-query retry returns an error) and is exactly what the health canary is for —
the GraphQL analog of selector rot, but loud instead of silent.

**Out of scope for v1:** subscriptions / WebSockets. WebMCP tools are request/response;
a subscription has no place to stream to.

## Same-origin enforcement

The single load-bearing invariant, so it gets its own section:

- `api.baseUrl` must be same-origin with a host covered by the config's `urlPatterns`.
  Validated at publish (schema-level) and again at execution (executor-level) — a
  registry-side bug must not be enough to break the invariant.
- The executor constructs the final URL itself from `baseUrl` + `path` + `query`;
  path/query templates are bound from _validated_ tool input, and the resolved URL is
  re-checked against `baseUrl`'s origin after binding (placeholder values cannot
  smuggle an origin change — `subreddit = "x HTTP/1.1\r\nHost:"` class attacks included).
- `auth` token sources fetch only from declared endpoints; tier-3 `request()` goes
  through the same check.
- Cookies/credentials are the page's own (`credentials: "include"` equivalent) — that's
  the point: tools act as the logged-in user _on that site_, and only there.

Cross-origin APIs (a site whose data lives on `api.otherhost.com`) are deliberately not
supported in v1 — the config's `urlPatterns` would need to cover the API host and the
tool only works while the user has a session there. Worth revisiting if real configs
demand it; the invariant gets looser, so it needs its own design.

## Trust model

The model is **curated + open source** — the Greasyfork analogy applied to configs that
may now contain code:

- **Human-readable or reject.** Publish-time lint rejects minified or obfuscated code
  in tier-2/tier-3 fields (heuristics: line-length distribution, identifier entropy,
  banned token density). Reviewers read what users run.
- **Code is rendered prominently in the registry UI** before install — not buried behind
  a "view source" link. Install = "I have seen the code" the way Greasyfork's install
  page works.
- **Install counts as signal** (already the data model — `COUNT(*) GROUP BY
definition_id` on `installs`).
- **Version pinning is the containment mechanism.** Installs pin to
  `definition_versions.id`; a malicious or broken new version never auto-propagates —
  users pull updates explicitly after reading the changelog, and rollback is moving the
  pin back. This is what makes shipping executable content survivable: a bad actor who
  edits a popular config reaches _zero_ installed users until each one opts in.
- **Tier is visible in the UI.** Tier-3 configs carry a persistent flag; tier-2 shows
  the slot code inline on the config page.

## MV3 constraints + spike plan

Tiers 2–3 execute string code, and Manifest V3 forbids `unsafe-eval` in content scripts.
MAIN-world injection (a `<script>` tag or `chrome.scripting.executeScript` with a
string) is blocked by strict page CSP on exactly the sites we care about (GitHub's CSP
is the canonical wall). Candidate paths:

1. **`chrome.userScripts` API** — executes registered user scripts outside page CSP, but
   requires the `userScripts` permission _and_ a user-facing "Allow User Scripts"
   toggle in `chrome://extensions`. Real onboarding friction; acceptable if it's the
   only path.
2. **Packaged runner function** — ship a fixed, generic evaluator in the extension
   bundle (a tiny interpreter or a constrained function factory compiled at build time)
   and feed it the config's strings. Whether a sufficiently capable runner survives
   MV3 review and CSP is the open technical question.
3. **Script-tag injection** — dead on strict-CSP sites. Listed for completeness.

**Spike before building tiers 2–3.** The spike's job: execute a registry-delivered
string function in page context on GitHub (strict CSP) and on Reddit, under MV3, via
each viable path; document permissions friction and CSP behavior. Tier 1 needs **no**
code execution — the derived-call engine is ordinary extension code operating on config
data — so it is buildable today and is not blocked on the spike.

## Build order

1. **`packages/schema`: zod for the `api` block + tests.** Endpoint/auth/document/
   projection schemas, placeholder↔inputSchema cross-validation (mirroring the existing
   `{{param}}` check in `tool.ts`), same-origin `baseUrl`↔`urlPatterns` check.
2. **Executor derived-call engine** (extension): request construction, token sources,
   `returns` projection, `errorPath` failure, APQ retry, output budgeting.
3. **Reddit flagship config on tier 1 alone** — REST read (`subredditHot`) + write
   (`comment` with the modhash token source) + one GraphQL endpoint exercising
   `errorPath` and `persistedQuery`. This is the proof of the whole model.
4. **MV3 spike → scoped script slots** (tier 2), with publish-time lint in apps/web.
5. **Full `evaluate`** (tier 3) last — UI flagging, elevated curation flow.

## Open questions

- **Approval-before-publish vs open-publish + moderation?** Greasyfork is open-publish:
  anything goes live immediately, moderation reacts to reports, and install counts +
  code display do the work. Approval-before-publish raises quality but doesn't scale
  and contradicts the "agents teaching agents" velocity. Current leaning: open-publish
  for tier 1, human review queue for anything containing tier-2/3 code — but this is
  undecided and shapes apps/web work.
- **Chrome Web Store "no remote code execution" policy risk.** The registry delivers JS
  (tiers 2–3) into an extension context at runtime, which reads squarely like the
  policy's definition of remotely hosted code. Tampermonkey precedent: user-script
  managers survive in the store, apparently on the argument that the user explicitly
  installs each script. Our per-config explicit install + pinned versions resembles
  that, but the risk of a store rejection (or a later policy enforcement wave) is real
  and could kill tier-2/3 delivery — needs an answer before those tiers ship; possibly
  a store build with code tiers disabled.
- **ShadowRealm as future sandboxing.** `ShadowRealm.prototype.evaluate` gives a real
  realm boundary for tier-2/3 code (no shared prototypes, explicit callable membrane).
  It's the right long-term home for slot execution; browser support and MV3/CSP
  interaction are unverified — fold into the spike if time permits, otherwise track.
- **Output projection language.** `returns` above is a placeholder syntax
  (path-with-pickers). Options: a minimal path grammar (invented, small), JSONPath
  (standard, heavier than we need), or defer shaping to tier-2 `response` slots and
  give tier 1 only path arrays. Decide with the schema PR.
- **How does `ctx` compose?** What tier-2 slots and tier-3 scripts receive (tokens from
  `auth` sources, prior step outputs, endpoint metadata) is under-specified; pin down
  when the executor is built.
- **Cross-origin APIs.** v1 is same-origin-only (see above). Real candidate sites with
  split frontend/API hosts will pressure this — what's the loosest invariant we can
  live with?
- **Health canary for API configs.** Loud failures are only useful if something listens.
  The canary (out of scope per SPEC but reserved-for in the schema) should replay
  tier-1 calls against live sites; what runs it, and how do auth'd writes get canaried
  safely (a write canary posts real comments)?
- **`minEngine` bump policy.** The `api` block is additive, but executors that don't
  understand it must not silently register inert tools. Presumably configs using `api`
  set `minEngine` to the engine version that introduces it — confirm the extension
  actually refuses too-new configs today.
