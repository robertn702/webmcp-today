// Re-registration across SPA navigations. A content script registers once at
// document_idle, so a client-side route change would otherwise leave the
// previous route's tools registered and never pick up the new route's.

export interface NavigationWatcherOptions {
  /** The current URL, read on every check. */
  getUrl: () => string;
  /** A registration pass for `url`. Its signal aborts when the URL changes,
   * which is what unregisters that pass's tools. */
  run: (url: string, signal: AbortSignal) => Promise<void>;
  /** Where popstate/hashchange are observed. Defaults to `window`. */
  target?: EventTarget;
  /** Poll period, see below. */
  intervalMs?: number;
}

/**
 * Runs a registration pass for the current URL, then again on every URL change,
 * aborting the previous pass's signal first so its tools go away with it.
 *
 * Detection is `popstate` + `hashchange` plus a URL poll. The poll is not
 * laziness: `history.pushState`/`replaceState` are the common SPA route change
 * and a content script cannot see them — patching `history` from the isolated
 * world only intercepts the isolated world's own calls, never the page's. The
 * alternative is `chrome.webNavigation.onHistoryStateUpdated` in the background
 * script, which costs a "read your browsing history" permission warning.
 *
 * Passes are serialized and deduped: an unchanged URL is a no-op, and a pass
 * queued by a navigation waits for the aborted one to settle rather than
 * interleaving registrations with it.
 *
 * Returns a teardown for symmetry and tests; the content script never calls it
 * (the page going away is the teardown).
 */
export function startNavigationWatcher(options: NavigationWatcherOptions): () => void {
  const { getUrl, run, target = window, intervalMs = 500 } = options;

  let currentUrl: string | undefined;
  let controller: AbortController | undefined;
  let queue: Promise<void> = Promise.resolve();

  const check = (): void => {
    const url = getUrl();
    if (url === currentUrl) return;
    currentUrl = url;

    // Drops the previous route's tools: registerTool takes this signal.
    controller?.abort();
    const { signal } = (controller = new AbortController());

    queue = queue
      .then(async () => {
        // The URL may have changed again while the previous pass drained.
        if (signal.aborted) return;
        await run(url, signal);
      })
      .catch((err: unknown) => {
        console.warn(`[webmcp-cafe] Registration pass failed for ${url}:`, err);
      });
  };

  target.addEventListener("popstate", check);
  target.addEventListener("hashchange", check);
  const timer = setInterval(check, intervalMs);
  check();

  return () => {
    clearInterval(timer);
    target.removeEventListener("popstate", check);
    target.removeEventListener("hashchange", check);
    controller?.abort();
  };
}
