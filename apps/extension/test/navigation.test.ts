import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startNavigationWatcher } from "../src/lib/navigation.js";

/** Let queued microtasks (the pass chain) drain. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface Pass {
  url: string;
  signal: AbortSignal;
}

/** A watcher over a URL we control, with popstate/hashchange driven by hand and
 * the poll parked far in the future unless a test asks for it. */
function watcher(startUrl: string, intervalMs = 1_000_000) {
  const target = new EventTarget();
  const passes: Pass[] = [];
  let url = startUrl;
  /** Resolves the in-flight pass; set per test that needs to hold one open. */
  let release: (() => void) | undefined;

  const stop = startNavigationWatcher({
    getUrl: () => url,
    run: async (passUrl, signal) => {
      passes.push({ url: passUrl, signal });
      if (release) await new Promise<void>((resolve) => (release = resolve));
    },
    target,
    intervalMs,
  });

  return {
    passes,
    stop,
    navigate(next: string) {
      url = next;
      target.dispatchEvent(new Event("popstate"));
    },
    /** A route change a content script cannot observe (pushState). */
    navigateSilently(next: string) {
      url = next;
    },
    hashChange(next: string) {
      url = next;
      target.dispatchEvent(new Event("hashchange"));
    },
    holdNextPass() {
      release = () => {};
    },
    releasePass() {
      release?.();
      release = undefined;
    },
  };
}

describe("startNavigationWatcher", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("runs one pass for the initial URL", async () => {
    const w = watcher("https://reddit.com/r/webdev");
    await flush();

    expect(w.passes.map((p) => p.url)).toEqual(["https://reddit.com/r/webdev"]);
    expect(w.passes[0]?.signal.aborted).toBe(false);
    w.stop();
  });

  it("re-runs on a URL change and aborts the previous pass's tools", async () => {
    const w = watcher("https://reddit.com/r/webdev");
    await flush();

    w.navigate("https://reddit.com/r/typescript");
    await flush();

    expect(w.passes.map((p) => p.url)).toEqual([
      "https://reddit.com/r/webdev",
      "https://reddit.com/r/typescript",
    ]);
    expect(w.passes[0]?.signal.aborted).toBe(true);
    expect(w.passes[1]?.signal.aborted).toBe(false);
    w.stop();
  });

  it("is a no-op when an event fires without the URL changing", async () => {
    const w = watcher("https://reddit.com/r/webdev");
    await flush();

    w.navigate("https://reddit.com/r/webdev");
    w.hashChange("https://reddit.com/r/webdev");
    await flush();

    expect(w.passes).toHaveLength(1);
    expect(w.passes[0]?.signal.aborted).toBe(false);
    w.stop();
  });

  it("picks up pushState-style changes by polling, which a content script cannot observe", async () => {
    vi.useFakeTimers();
    const w = watcher("https://reddit.com/r/webdev", 500);
    await vi.advanceTimersByTimeAsync(0);

    w.navigateSilently("https://reddit.com/r/typescript");
    await vi.advanceTimersByTimeAsync(500);

    expect(w.passes.map((p) => p.url)).toEqual([
      "https://reddit.com/r/webdev",
      "https://reddit.com/r/typescript",
    ]);
    w.stop();
  });

  it("serializes passes: a navigation waits for the aborted pass to settle", async () => {
    const w = watcher("https://reddit.com/r/webdev");
    w.holdNextPass();
    await flush();
    expect(w.passes).toHaveLength(1);

    w.navigate("https://reddit.com/r/typescript");
    await flush();

    // First pass still in flight, so the second has not started — but its tools
    // are already revoked.
    expect(w.passes).toHaveLength(1);
    expect(w.passes[0]?.signal.aborted).toBe(true);

    w.releasePass();
    await flush();

    expect(w.passes.map((p) => p.url)).toEqual([
      "https://reddit.com/r/webdev",
      "https://reddit.com/r/typescript",
    ]);
    w.stop();
  });

  it("keeps watching after a pass throws", async () => {
    const target = new EventTarget();
    const passes: string[] = [];
    let url = "https://reddit.com/r/webdev";
    const stop = startNavigationWatcher({
      getUrl: () => url,
      run: async (passUrl) => {
        passes.push(passUrl);
        throw new Error("lookup exploded");
      },
      target,
      intervalMs: 1_000_000,
    });
    await flush();

    url = "https://reddit.com/r/typescript";
    target.dispatchEvent(new Event("popstate"));
    await flush();

    expect(passes).toEqual(["https://reddit.com/r/webdev", "https://reddit.com/r/typescript"]);
    expect(warn).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stops polling and drops the current pass's tools on teardown", async () => {
    vi.useFakeTimers();
    const w = watcher("https://reddit.com/r/webdev", 500);
    await vi.advanceTimersByTimeAsync(0);

    w.stop();
    expect(w.passes[0]?.signal.aborted).toBe(true);

    w.navigateSilently("https://reddit.com/r/typescript");
    await vi.advanceTimersByTimeAsync(5000);

    expect(w.passes).toHaveLength(1);
  });
});
