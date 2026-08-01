// Re-registration across SPA navigations. A content script registers once at
// document_idle, so a client-side route change would otherwise leave the
// previous route's tools registered and never pick up the new route's.

export interface NavigationWatcherOptions {
  /** The current URL, read on every check. */
  getUrl: () => string;
  /** A registration pass for `url`. Its signal aborts when the URL or local
   * package authority changes, which unregisters that pass's tools. */
  run: (url: string, signal: AbortSignal) => Promise<void>;
  /** Where popstate/hashchange are observed. Defaults to `window`. */
  target?: EventTarget;
  /** Poll period, see below. */
  intervalMs?: number;
  /** Subscribe to non-navigation changes that require re-matching the current
   * URL, such as a package install or revocation-list update. */
  subscribeInvalidation?: (invalidate: () => void) => () => void;
}

/**
 * Runs a registration pass for the current URL, then again on every URL change
 * or explicit invalidation, aborting the previous pass's signal first so its
 * tools go away with it.
 *
 * Detection is `popstate` + `hashchange` plus a URL poll. The poll is not
 * laziness: `history.pushState`/`replaceState` are the common SPA route change
 * and a content script cannot see them — patching `history` from the isolated
 * world only intercepts the isolated world's own calls, never the page's. The
 * alternative is `chrome.webNavigation.onHistoryStateUpdated` in the background
 * script, which costs a "read your browsing history" permission warning.
 *
 * Passes are serialized and URL-change checks are deduped. Explicit
 * invalidations may re-run an unchanged URL; every queued pass waits for the
 * aborted one to settle rather than interleaving registrations with it.
 *
 * Returns a teardown for symmetry and tests; the content script never calls it
 * (the page going away is the teardown).
 */
export function startNavigationWatcher(options: NavigationWatcherOptions): () => void {
  const { getUrl, run, target = window, intervalMs = 500, subscribeInvalidation } = options;

  let currentUrl: string | undefined;
  let controller: AbortController | undefined;
  let queue: Promise<void> = Promise.resolve();

  const check = (force = false): void => {
    const url = getUrl();
    if (!force && url === currentUrl) return;
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
        console.warn(`[webmcp-today] Registration pass failed for ${url}:`, err);
      });
  };
  const checkNavigation = (): void => check();

  target.addEventListener("popstate", checkNavigation);
  target.addEventListener("hashchange", checkNavigation);
  const unsubscribeInvalidation = subscribeInvalidation?.(() => check(true));
  const timer = setInterval(checkNavigation, intervalMs);
  check();

  return () => {
    clearInterval(timer);
    target.removeEventListener("popstate", checkNavigation);
    target.removeEventListener("hashchange", checkNavigation);
    unsubscribeInvalidation?.();
    controller?.abort();
  };
}
