import type { StorageArea } from "../src/lib/store-schema.js";

/**
 * In-memory chrome.storage.local for tests: values JSON round-trip (the real
 * store serializes to JSON), every call yields a microtask (so unserialized
 * concurrent read-modify-writes actually interleave), and multi-key `set` is
 * ATOMIC — every value is encoded before any key lands, and an injected
 * failure lands nothing. That models the platform's single-WriteBatch
 * guarantee; a fake with per-key writes would let tests pass against a weaker
 * contract than the one the store's design depends on.
 */
export interface FakeStorageArea extends StorageArea {
  /** Rejects the next set() with NO key applied (quota/IO failure, crash). */
  failNextSet(): void;
  /** Rejects the next remove() with the keys left in place (interrupted uninstall). */
  failNextRemove(): void;
  /** Raw decoded contents, for assertions. */
  snapshot(): Record<string, unknown>;
}

export function createFakeStorageArea(seed: Record<string, unknown> = {}): FakeStorageArea {
  const data = new Map<string, string>();
  for (const [key, value] of Object.entries(seed)) data.set(key, JSON.stringify(value));
  let failSet = false;
  let failRemove = false;

  function decode(keys: Iterable<string>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const raw = data.get(key);
      if (raw !== undefined) out[key] = JSON.parse(raw);
    }
    return out;
  }

  return {
    async get(keys = null) {
      await Promise.resolve();
      const wanted = keys === null ? [...data.keys()] : typeof keys === "string" ? [keys] : keys;
      return decode(wanted);
    },
    async set(items) {
      await Promise.resolve();
      if (failSet) {
        failSet = false;
        throw new Error("fake storage: set failed (injected)");
      }
      const encoded: Array<[string, string]> = [];
      for (const [key, value] of Object.entries(items)) encoded.push([key, JSON.stringify(value)]);
      for (const [key, value] of encoded) data.set(key, value);
    },
    async remove(keys) {
      await Promise.resolve();
      if (failRemove) {
        failRemove = false;
        throw new Error("fake storage: remove failed (injected)");
      }
      for (const key of typeof keys === "string" ? [keys] : keys) data.delete(key);
    },
    failNextSet() {
      failSet = true;
    },
    failNextRemove() {
      failRemove = true;
    },
    snapshot() {
      return decode(data.keys());
    },
  };
}
