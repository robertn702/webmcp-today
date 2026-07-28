# Product Marketing Context

**Document version:** v4
**Last updated:** 2026-07-26

Source of truth for positioning, audience, and voice. Every marketing skill
(copywriting, cro, copy-editing, …) reads this before drafting. Product facts
live in `AGENTS.md` / `ARCHITECTURE.md`; when they disagree, the code wins.

> **Pre-production.** No users, no revenue, no testimonials, no metrics. Sections
> that would require them are marked `None yet` rather than filled with
> plausible-sounding invention. Do not write proof points this document can't back.

## Product Overview

**One-liner:** MCP tools for any site.

**Supporting line:** Community-written packages call the site's own API, so your
agent gets real tools instead of a scraping loop.

**What it does:** WebMCP lets a site publish real tools for AI agents; almost no
site has. Humans and agents author declarative packages — URL patterns plus tool
definitions backed by DOM steps or the site's own HTTP API — and publish them to
the registry. The extension looks up packages for the page you're on and registers
their tools on `document.modelContext`, so an agent calls `reddit_comment`
instead of guessing which div is the reply box. An MCP server exposes the same
registry to agents outside the browser.

**Product category:** Registry / package index for agent tooling. Nearest
recognisable shelf: userscript registry (Greasyfork, OpenUserJS), but for agent
tools rather than page scripts.

**Product type:** Developer tool — registry web app + browser extension +
published npm packages (`schema`, `mcp`). No hosted paid tier.

**Business model:** None today. Growth metric is packages published and
installs, not revenue. Licensing is undecided, so **no copy may claim the
product is free, open source, or permanently either** — that claim was
deliberately removed from the site (v3).

## Target Audience

**Target companies:** N/A — individual developers and agent operators, not
companies. No procurement, no seats.

**Decision-makers:** The installer is the decision-maker. Zero-approval adoption.

**Primary use case:** An agent needs to do something real on a site (search,
post, extract, fill) and the site exposes no tools, so the agent is left
scraping the DOM and guessing.

**Jobs to be done:**

- Give my agent reliable tools on a site that shipped none.
- Stop maintaining brittle selector-based automation that breaks silently.
- Publish a tool package once and let other people's agents use it.

**Use cases:** Reddit search/comment, and by extension any site where a
repeated agent workflow is worth naming as a tool.

## Personas

Three audiences share one site. Every surface should serve at least one of them
without confusing the other two.

| Persona                             | Cares about                                                                | Challenge                                                                         | Value we promise                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Agent operator** (installs)       | Does my browser agent get more capable in the next five minutes?           | Doesn't know what WebMCP is, or that a flag is required; may have no package for their site | Install a package, get named tools on the page — nothing to write                               |
| **Package author** (human developer) | Format legibility, validation feedback, ownership, versioning              | Writing a package blind, unsure what's valid until submit fails                     | A zod-validated format, append-only versions, and install count as the only ranking that matters |
| **Autonomous agent** (writes)       | Machine-actionable path: schema, endpoint, auth, error shape               | Copy written for humans buries the API affordance in prose                          | One `POST /api/packages` with a Bearer key; the agent that needed the tool contributes it       |

## Problems & Pain Points

**Core problem:** Agents operate websites by guessing at the DOM. WebMCP is the
fix, and adoption is roughly zero, so the fix is unavailable on every site that
matters.

**Why alternatives fall short:**

- Waiting for sites to adopt WebMCP: the sites you use daily won't be first, and
  wouldn't ship the tools you actually want anyway.
- Scraping / computer-use agents: a selector breaks the day a class name changes
  and nothing tells you. Failure is silent and looks like the agent being dumb.
- Hand-rolled per-site automation: works for you, on your machine, once. No
  sharing, no versioning, no reuse.

**What it costs them:** Silent breakage, re-debugging the same site repeatedly,
and agent runs that fail in ways that are hard to attribute.

**Emotional tension:** The agent looks incompetent when the real problem is the
page. Distrust of anything that runs inside a session you're logged into.

## Competitive Landscape

**Direct:** Nothing comparable ships today — no other WebMCP package registry.
The realistic rival is a site shipping WebMCP natively, which beats us where it
happens and is vanishingly rare.
**Secondary:** Browser-automation and computer-use agents (Playwright-driven
agents, Stagehand/Browserbase-style tooling) — same job, no shared artifact,
brittle and silent when the page changes.
**Indirect:** Userscript registries (Greasyfork) and MCP server directories —
adjacent distribution models, neither delivering in-page tools to a browser agent.

## Differentiation

**Key differentiators:**

- Third-party packages for sites that never adopted WebMCP — no site cooperation needed.
- Agents are first-class authors, not just consumers: publishing is one API call.
- Trust from install count and the data model, not a review queue or a checkmark.
- API-mode packages declare the site's own HTTP API, so failures are loud (a 4xx
  you can see) instead of a div you can't find.

**How we do it differently:** Packages are data, not code. No `evaluate` step, so
nothing arbitrary executes in a page you're signed into. Versions are
append-only and installs pin to a version, so a bad update reaches zero
installed users until each one opts in.

**Why that's better:** The failure modes are visible and the blast radius is
bounded by the schema, not by trust in the author.

**Why customers choose us:** It's the only way to get tools on a site that
hasn't shipped them, and the cost of trying is one install.

## Objections

| Objection                                              | Response                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| "Random code from strangers, running in my logged-in session?" | Packages are declarative data with no arbitrary-code step; API calls are locked to the package's own origin, checked at publish and at run time. |
| "How do I know a package isn't malicious or broken?"    | Install count is the signal, versions are append-only, and your install is pinned — an update can't reach you until you move the pin. |
| "This needs a Chrome flag, so it's a toy."             | True and stated up front: Chrome 149+ with `chrome://flags/#enable-webmcp-testing`. It's an origin-trial-era platform; say so plainly rather than bury it. |
| "There's no package for the site I care about."         | Write one — it's a JSON document, validated on submit — or point your agent at the API and have it publish one.                        |
| "WebMCP could change under you."                       | Tracked openly: `docs/platform-risks.md`, incl. the `tools=()` kill switch and unsanctioned-registration risk.                        |

**Anti-persona:** Anyone wanting a zero-setup consumer product today (the
extension isn't in the Web Store and the flag is mandatory), and anyone wanting
a curated, vetted, guaranteed-safe catalogue — there is no approval queue by design.

## Switching Dynamics

**Push:** Selector-based automation that breaks silently; agents that flail on
sites with no tools.
**Pull:** Named tools appear on a page in five minutes, with no site cooperation.
**Habit:** Rewriting the same scraping glue per project; accepting that agents
are bad at websites.
**Anxiety:** Third-party packages executing in an authenticated session; Chrome
flag friction; a registry that might be abandoned.

## Customer Language

**How they describe the problem:** None yet — no user interviews. Do not
fabricate verbatims. Closest honest sources: the WebMCP spec discussions and
`docs/platform-risks.md`.
**How they describe us:** None yet.

**Words to use:** install, package, tool, register, publish, version, pin,
extension, agent, site. Concrete verbs from the product's own vocabulary.
"Package" is the noun everywhere now — copy and code (routes, API paths, schema
exports, DB tables, MCP tool names) all say `package`; there is no more `config`
split to remember.

**Words to avoid:**

- "Greasyfork for the agentic web" — useful internal shorthand, **not** for
  user-facing copy: most readers don't know Greasyfork, and it was deliberately
  removed from the landing page (commit 6f5cba6). Keep it for README/investor/
  explainer contexts where a knowing reader is likely.
- "Agents teaching agents" — same call: cute, and it was cut for being vague.
- "Teach an agent to use any website" — overclaims (needs a package to exist, plus
  Chrome 149+ and the flag) and misnames the user's verb, which is _install_.
- Hype vocabulary generally: seamless, effortless, revolutionary, unlock,
  supercharge, magic, "the future of". Also no exclamation points.
- Any claim of verification, review, or safety guarantee — the trust model is
  explicitly not that.

**Glossary:**

| Term            | Meaning                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| Package         | A published document: `{ domain, urlPatterns[], title, description, tools[] }`. The one name, in copy and code alike |
| Tool            | One named, callable capability with an input schema and an execution block           |
| Version         | Append-only revision of a package's tools/patterns; the served truth                  |
| Install         | A user's pin to a specific version; the trust signal when counted                    |
| Registration    | The extension calling `registerTool` so a page's agent can see a tool                |
| DOM mode        | Execution via declarative steps (navigate/click/fill/extract/…) — no `evaluate`      |
| API mode        | Execution via the site's own HTTP API, locked to the package's origin                 |
| From your terminal | Agent outside the browser using the Cafe MCP server                              |
| In the browser  | Browser's own agent using tools the extension injected                              |

## Brand Voice

**Tone:** Direct, developer-first, high-signal, anti-hype. Concrete nouns over
abstractions. State limits in the same breath as claims — the constraint _is_ the
credibility.

**Style:** Short declaratives. Technical vocabulary used precisely, never as
decoration. Explain by naming the mechanism ("installs pin to a version"), not by
adjective ("secure"). A dry, wry register is welcome; jokes that cost clarity are not.

**Personality:** Precise, candid, unglamorous, mechanism-obsessed, quietly opinionated.

**House rules:**

- Say what breaks and when. Skeptic-first: name the objection before the reader does.
- Never claim verification or safety guarantees; describe the data model instead.
- The Chrome flag requirement appears wherever someone might try to install.
- Prefer the product's own vocabulary over invented marketing terms.
- Prose mechanics (punctuation, sentence construction, banned vocabulary) follow
  `~/git/robertn702/nexus/docs/context/personal/writing-style.md`. No em dashes,
  colons or semicolons in body copy.

## Proof Points

**Metrics:** None yet (pre-launch; registry counters on the landing page are live
but small — 6 curated packages / 18 tools from `@webmcp-cafe/curated-packages`).
**Customers:** None.
**Testimonials:** None. Do not invent.
**Value themes:**

| Theme                             | Proof                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Tools without site cooperation    | Extension registers third-party packages on `document.modelContext`                            |
| Bounded blast radius              | No `evaluate` step; API mode origin-checked at publish and run time                            |
| Updates can't ambush you          | `package_versions` append-only; installs pin; rollback is re-pinning                            |
| Open by construction              | No approval queue; rival packages allowed; install count + pattern specificity rank them        |
| Agents can contribute             | `POST /api/packages` with a Bearer API key; published zod schema                                |

## Goals

**Business goal:** Seed a registry with enough real packages that the next person
finds one for their site — supply before demand.

**Conversion action:** Install the extension (primary; currently `/extension`, a
run-from-source stub until the Web Store listing exists). Secondary: publish a
package.

**Current metrics:** None tracked yet.

## Changelog

_Newest first. One line per revision: what changed and why._

- v4 (2026-07-26) — The `config`/`package` split closed: code (routes, schema
  exports, DB tables, MCP tool names) now says `package` too, so the v3 caveat
  ("copy only") no longer applies. Glossary and "Words to use" updated to match.
- v3 (2026-07-25) — "Package" adopted as the user-facing noun for a published
  config (copy only — routes, API paths, schema exports, MCP tool names and DB
  tables keep `config`); category phrase fixed to "WebMCP tool registry"; the
  "Free and open source" claim removed site-wide and not replaced, pending a
  licensing decision — do not reintroduce a free/open-source/licensing claim.
- v2 (2026-07-25) — New one-liner: lead with the capability, not the
  registry-plus-extension structure. Assumes MCP literacy so WebMCP drops out of
  the lead, and moves the foil from "sites that never adopted a spec" to the
  browser-use agents readers have actually used. Supporting line carries the
  mechanism. Caveat: that line describes an API-only product, and DOM mode is
  still in the schema — it lands honest once DOM mode is removed.
- v1 (2026-07-25) — Initial context: three-audience split (agent operator /
  config author / autonomous agent), anti-hype voice rules, and an explicit
  do-not-ship list for the Greasyfork and "agents teaching agents" framings that
  commit 6f5cba6 removed from the landing page.
