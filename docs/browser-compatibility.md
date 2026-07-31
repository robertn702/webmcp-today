# WebMCP browser compatibility

Last verified: 2026-07-31. This covers the native WebMCP API required by the
extension to register page tools; it is not a generic extension-compatibility
matrix.

## Confirmed support

| Browser                 | Minimum version             | How to enable                                              | Confidence | Notes                                                                                                                                                             |
| ----------------------- | --------------------------- | ---------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Chrome (desktop) | 146 developer trial         | `chrome://flags/#enable-webmcp-testing`                    | Confirmed  | The Chromium intent records the developer trial starting in Chrome 146. Chrome's current docs explicitly direct local developers to this flag.                    |
| Google Chrome (desktop) | 149-156                     | Same flag, or an origin-trial token for a first-party site | Confirmed  | Chrome's public origin trial spans 149 through 156. An origin-trial token cannot enable WebMCP for our injected packages, so extension users still need the flag. |
| Google Chrome (desktop) | 157 (planned, not verified) | None expected                                              | Planned    | Chromium's intent estimates shipping on desktop at 157. Do not advertise flag-free support until that release is tested.                                          |

The product's supported browser baseline remains **Chrome 149+**. Chrome 146-148
exposed the developer-trial API, but Chrome 149 is our tested baseline and is
required for the current DevTools WebMCP workflow.

## Candidates that need a local probe

| Browser                                                       | Chromium version evidence                                                 | WebMCP status                                                                                       | What to do                                                                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brave desktop                                                 | Brave 1.88 shipped Chromium 146; Brave 1.92 currently ships Chromium 150  | Likely inherits the Chromium implementation, but Brave has not published a WebMCP support statement | Check `brave://flags/#enable-webmcp-testing`, enable it if present, then run the probe below. Treat a passing probe as browser/version-specific, not a blanket Brave guarantee. |
| Microsoft Edge desktop                                        | Chromium-based; Edge 147's official web-platform notes do not list WebMCP | Unconfirmed                                                                                         | Check `edge://flags/#enable-webmcp-testing` and run the probe. Do not claim Edge support from third-party reports.                                                              |
| Other Chromium browsers (Chromium, Vivaldi, Opera, Arc, etc.) | Varies by their embedded Chromium milestone                               | Unconfirmed                                                                                         | The WebMCP code can be inherited at Chromium 146+, but vendors can omit features or flags. Check the browser's `...://flags` page and probe the actual release.                 |

No public vendor evidence currently confirms WebMCP for Firefox or Safari. The
Chromium intent records **no Gecko signal** and **no WebKit signal**. They should
be treated as unsupported for this extension until a vendor release note and a
runtime probe prove otherwise.

## Fast verification

Version numbers are only a shortlist. The authoritative test is whether the
running browser exposes a usable `registerTool` method on a normal,
origin-isolated HTTPS page.

1. In a Chromium browser, open its flags page: `chrome://flags/#enable-webmcp-testing`, `brave://flags/#enable-webmcp-testing`, or `edge://flags/#enable-webmcp-testing`.
2. If the flag exists, set it to **Enabled** and relaunch. If it is absent, the
   browser/version is unsupported for our current path.
3. Visit any ordinary HTTPS page that does not opt out with `Permissions-Policy: tools=()`.
4. Open DevTools Console and run:

```js
const mc = document.modelContext ?? navigator.modelContext;
({
  browser: navigator.userAgent,
  modelContext: Boolean(mc),
  registerTool: typeof mc?.registerTool,
});
```

The result must show `modelContext: true` and `registerTool: "function"`.
This mirrors the extension's actual detection in
[`apps/extension/src/lib/model-context.ts`](../apps/extension/src/lib/model-context.ts).
Seeing the flag alone is insufficient: a site can still block registration with
`Permissions-Policy: tools=()`, or fail WebMCP's origin-isolation requirement.

For the dev browser launched by `bun run dev`, flags are force-enabled through
`--enable-features=WebMCP,WebMCPTesting,DevToolsWebMCPSupport`; check the
command line in `chrome://version`, not the flags UI.

## Evidence and monitoring

- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp) documents the local testing flag and the Chrome 149 origin trial.
- [Chromium's Intent to Experiment](https://groups.google.com/a/chromium.org/g/blink-dev/c/gmYffo5WOE8/m/OJxuQRP3AAAJ) records developer trial 146, origin trial 149-156, planned desktop shipping at 157, and no Gecko/WebKit signals.
- [Microsoft Edge 147 web-platform release notes](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/147) do not list WebMCP; that is why Edge remains unconfirmed.
- [Brave's Chromium 146 upgrade](https://github.com/brave/brave-browser/issues/51995) and [current Brave release notes](https://brave.com/latest/) establish the Chromium-version candidates only, not a Brave WebMCP commitment.

Re-check the Chromium intent and browser release notes at each milestone. Move a
candidate to "confirmed" only after the vendor documents support and the probe
passes on a released desktop build.
