# WebMCP Cafe extension (spike)

WXT extension that injects community WebMCP tool configs into sites that haven't
implemented WebMCP themselves. Spike mode: configs are bundled from `configs/`
(no registry server yet).

The DOM executor is ported from Joakim Selemyr's MIT-licensed
[webmcp-extension](https://github.com/Joakim-Sael/webmcp-extension) — credit to
him for the hard-won tricks: native prototype value setter for React inputs,
synthetic paste events for Lexical/Draft editors, shadow-DOM-deep queries,
`:has-text()` selectors, `isTrusted` clicks. Deliberate difference: the
`evaluate` step is not ported — no arbitrary code execution in the user's
logged-in page.

## Manual verification

1. Chrome Canary/Dev (149+) with `chrome://flags/#enable-webmcp-testing`.
2. Install the Model Context Tool Inspector extension from the Chrome Web Store.
3. `bun run dev` here (or `bun run build` + load `.output/chrome-mv3` unpacked).
4. Visit a configured site (news.ycombinator.com, a GitHub repo, a Wikipedia
   article, MDN, an npm package page) and check the Inspector lists the
   `hn_*` / `gh_*` / `wiki_*` / `mdn_*` / `npm_*` tools.
5. Invoke a read-only tool (e.g. `hn_list_stories`) and confirm the output.

## Known limitations (spike)

- Tools register once per page load; SPA route changes don't re-match configs.
- Registration from a content script relies on the testing flag relaxing
  WebMCP's origin-isolation gate; whether that survives the stable release is
  an open question (see AGENTS.md).
