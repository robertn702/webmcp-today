# Platform risks

What WebMCP Today depends on upstream, and how each dependency can break. Last
reviewed 2026-07-24. Actionable items live in BACKLOG.md and point here; delete
a section when its risk resolves.

## Extension-side registration is unsanctioned (the existential one)

Chrome's docs describe extensions as tool _consumers_ — "Chrome Extensions can
query and execute WebMCP tools using content scripts"
([secure-tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools),
[agent security](https://developer.chrome.com/docs/agents/security)). Nothing
sanctions an extension _registering_ tools on a page that didn't opt in, which
is our core mechanism. Tools carry no provenance today, so injected tools are
indistinguishable from first-party ones.

- [webmachinelearning/webmcp#74](https://github.com/webmachinelearning/webmcp/issues/74)
  — the live thread; the WECG rep asks "should extensions be able to expose
  their own WebMCP capabilities to websites?" (unanswered). Subscribe here.
- [#16](https://github.com/webmachinelearning/webmcp/issues/16) — WG
  resolution: "JavaScript injection by external Agents to interact with WebMCP
  is not supported" (consumer direction, but shows disposition toward
  injection-based workarounds).

Why it probably won't break: extensions with `host_permission` can already
manipulate the page arbitrarily _without_ WebMCP (Chrome's own docs say so), so
gating `registerTool` buys the platform nothing in capability terms — it only
removes the structured path.

Realistic tail risk: provenance marking at stable — agents rank or filter
injected tools below first-party. That degrades rather than kills; official
tools win ties, community packages become second-class. Worth designing for
regardless (e.g. don't build UI that assumes parity with site-registered tools).

Fallback if registration does break: the package format's API executor doesn't
need WebMCP as transport — an extension can still perform the same-origin
calls for an agent through its own surface (side panel, or the WebMCP CDP
domain via `chrome.debugger`, already exposed in Chromium — see end of #74).
Agents stop discovering tools through the page's `modelContext`; the product
shape changes, it doesn't die.

## `Permissions-Policy: tools=()` — per-site kill switch (bounded)

A site sets one response header and every `registerTool` call throws
`SecurityError`. Implemented in Chrome 150, enforced in Blink above the JS
layer, not bypassable by injected script
([#178](https://github.com/webmachinelearning/webmcp/issues/178) — filed by a
product security engineer advocating it as standard defensive posture for
authenticated/payment pages, with a demo that is exactly our injection pattern).

Bounded: per-site, and self-limiting — the header also disables the site's
_own_ tools, so it's an opt-out of the agentic web entirely, not a targeted
weapon against us. Sites that want agent-mediated users won't set it; the ones
that will (banks, payment flows) were always hostile territory for injected
write tools.

An extension could strip the header via `declarativeNetRequest`. **Decision
2026-07-24: we don't**. It lowers the site's security posture
for all scripts, not just ours; it's the pattern CWS review exists to catch;
and the platform sides with the site if it escalates. Instead: catch the
`SecurityError`, mark the package site-blocked in the UI, treat those domains as
first-party-outreach candidates (feeds the "show official webmcps" item).
Note `tools=()` only blocks the WebMCP transport — classic content-script
automation still works on those pages.

Watch: `tools=()` graduating into baseline security guidance or framework/CDN
defaults. That trend — not the header itself — is the existential version.

## Origin-isolation gating — resolved, not a risk

`registerTool` rejects unless the document is origin-keyed
([spec](https://webmachinelearning.github.io/webmcp/)), but Chrome defaults to
origin-keyed agent clusters since the `document.domain` deprecation (~M115;
[Chromium doc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/security/document-domain.md),
[Chrome blog](https://developer.chrome.com/blog/document-domain-setter-deprecation)).
Only legacy sites sending `Origin-Agent-Cluster: ?0` fail. Chrome's WebMCP docs
confirm: "WebMCP is only available in origin-isolated documents… If a document
has `document.domain` enabled, WebMCP APIs are disabled."

The testing flag provides the API without an origin-trial token; it does not
relax origin isolation. (AGENTS.md already states this correctly.) No tracking
needed.

## The founding bet

Origin trial ends at Chrome 156. If WebMCP stalls, redesigns, or ships without
mainstream agent consumers, none of the above matters. Not hedgeable from
inside the project — it's the price of being early.

## Housekeeping

- `provideContext`/`clearContext` dropped from the spec
  ([#101](https://github.com/webmachinelearning/webmcp/issues/101), W3C
  resolution 2026-03-05), removal from Chromium in progress. Verified
  2026-07-24: no usage in apps/extension or packages/.
