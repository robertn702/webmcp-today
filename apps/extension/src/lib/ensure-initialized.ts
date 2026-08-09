import type { InstallsStore, ReadySchemaState } from "./installs-store.js";

// Extracted from background.ts so the memoization contract is unit-testable
// without importing wxt/browser. Behavior is unchanged: every wake path
// (message, alarm, startup) gates on the SAME initialize() call — concurrent
// callers share the in-flight promise rather than each triggering their own
// reset — and a rejection clears the memo so the next call retries instead of
// caching a permanent failure.

export function createEnsureInitialized(store: InstallsStore): () => Promise<ReadySchemaState> {
  let initPromise: Promise<ReadySchemaState> | undefined;

  return function ensureInitialized(): Promise<ReadySchemaState> {
    if (initPromise !== undefined) return initPromise;

    const initializing = store.initialize();
    initPromise = initializing;
    void initializing.catch(() => {
      if (initPromise === initializing) initPromise = undefined;
    });
    return initializing;
  };
}
