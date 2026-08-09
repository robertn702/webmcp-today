import { webMcpPackageSchema, type WebMcpPackage } from "@webmcp-today/schema";
import {
  INDEX_KEY,
  PKG_KEY_PREFIX,
  SCHEMA_VERSION_KEY,
  STORAGE_SCHEMA_VERSION,
  indexSchema,
  pkgKey,
  type IndexEntry,
  type InstallIndex,
  type StorageArea,
} from "./store-schema.js";

// Local install store over an injected StorageArea. Install is ONE atomic
// multi-key set (body + index — all lands or none, per store-schema.ts), so
// there is no write ordering and no crash window to GC after. Uninstall cannot
// be atomic (set and remove can't share a batch) and is ordered index-first so
// a crash leaves only an orphaned body, invisible to reads and collectable.

/** "newer" = storage written by a newer build; register nothing (same
 * invariant as minEngine). "corrupt" = schemaVersion isn't an integer. */
export type SchemaVersionState = "ok" | "newer" | "corrupt";

export interface InstallOptions {
  source: IndexEntry["source"];
  /** Registry origin the body was fetched from. */
  origin: string;
  now?: () => Date;
}

export type InstallResult =
  | { ok: true; entry: IndexEntry; replaced?: { versionId: string; version: number } }
  | { ok: false; reason: "schema-unreadable" | "invalid-body" };

export type UninstallResult =
  { ok: true } | { ok: false; reason: "schema-unreadable" | "not-installed" };

export type LoadPackageResult =
  { status: "ok"; body: WebMcpPackage } | { status: "missing" } | { status: "invalid" };

export interface InstallsStore {
  /** First-run setup + startup GC: writes schemaVersion when absent, resets
   * every `pkg:*` body and the index when the stored version is older than
   * the build's, then reclaims bodies orphaned by an interrupted uninstall.
   * Call on runtime.onStartup/onInstalled. Returns the schema state; does
   * nothing when it isn't "ok". */
  initialize(): Promise<SchemaVersionState>;
  readSchemaVersionState(): Promise<SchemaVersionState>;
  readIndex(): Promise<InstallIndex>;
  install(body: unknown, options: InstallOptions): Promise<InstallResult>;
  uninstall(packageId: string): Promise<UninstallResult>;
  loadPackage(packageId: string): Promise<LoadPackageResult>;
  /** Removes orphaned `pkg:` bodies; returns the removed keys. */
  collectOrphans(): Promise<string[]>;
}

export function createInstallsStore(area: StorageArea): InstallsStore {
  // Serializes index read-modify-writes: concurrent installs would otherwise
  // both read the index and the later set() would drop the earlier entry.
  // The chain is in-memory only — it does not survive worker death (accepted
  // for v1; installs are rare and user-initiated).
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  }

  async function readStoredVersion(): Promise<unknown> {
    return (await area.get(SCHEMA_VERSION_KEY))[SCHEMA_VERSION_KEY];
  }

  /** A stored version older than the build's is "ok" here — safe to read,
   * just not yet reset. initialize() is the only caller that needs to tell
   * "older" apart from "current"; every other caller (install/uninstall/
   * lookup) only runs after initialize() has already reset it, per the
   * ensureInitialized() gate in background.ts. */
  async function readSchemaVersionState(): Promise<SchemaVersionState> {
    const stored = await readStoredVersion();
    if (stored === undefined) return "ok";
    if (typeof stored !== "number" || !Number.isInteger(stored)) return "corrupt";
    return stored > STORAGE_SCHEMA_VERSION ? "newer" : "ok";
  }

  /** Wipes every `pkg:*` body and the index for an on-disk version older than
   * the build's — there is no migration story, so a stale package contract
   * is discarded rather than reinterpreted. Removal runs before the version
   * bump so a crash between the two leaves the version still "older" (the
   * next initialize() retries; removal of already-gone keys is a no-op). */
  async function resetLegacyStorage(): Promise<void> {
    const all = await area.get(null);
    const pkgKeys = Object.keys(all).filter((key) => key.startsWith(PKG_KEY_PREFIX));
    if (pkgKeys.length > 0) await area.remove(pkgKeys);
    await area.set({ [SCHEMA_VERSION_KEY]: STORAGE_SCHEMA_VERSION, [INDEX_KEY]: {} });
  }

  async function readIndex(): Promise<InstallIndex> {
    const raw = (await area.get(INDEX_KEY))[INDEX_KEY];
    if (raw === undefined) return {};
    const parsed = indexSchema.safeParse(raw);
    // An unparseable index reads as empty — surfaced by the popup's
    // "installs are gone" recovery state, not silently repaired here.
    return parsed.success ? parsed.data : {};
  }

  async function collectOrphansInner(): Promise<string[]> {
    const all = await area.get(null);
    const rawIndex = all[INDEX_KEY];
    const parsed = rawIndex === undefined ? undefined : indexSchema.safeParse(rawIndex);
    // A present-but-corrupt index must not turn GC into "delete every body".
    if (parsed !== undefined && !parsed.success) return [];
    const index: InstallIndex = parsed?.data ?? {};
    const orphaned = Object.keys(all).filter(
      (key) =>
        key.startsWith(PKG_KEY_PREFIX) && index[key.slice(PKG_KEY_PREFIX.length)] === undefined,
    );
    if (orphaned.length > 0) await area.remove(orphaned);
    return orphaned;
  }

  return {
    readSchemaVersionState,
    readIndex,

    initialize(): Promise<SchemaVersionState> {
      return enqueue(async () => {
        const state = await readSchemaVersionState();
        if (state !== "ok") return state;

        const stored = await readStoredVersion();
        if (typeof stored === "number" && stored < STORAGE_SCHEMA_VERSION) {
          await resetLegacyStorage();
          return "ok";
        }

        await area.set({ [SCHEMA_VERSION_KEY]: STORAGE_SCHEMA_VERSION });
        await collectOrphansInner();
        return state;
      });
    },

    install(body: unknown, options: InstallOptions): Promise<InstallResult> {
      return enqueue(async () => {
        const state = await readSchemaVersionState();
        if (state !== "ok") return { ok: false, reason: "schema-unreadable" };

        // webMcpPackageSchema's cross-field superRefine (applyDomainCrossValidation)
        // already enforces domain scope — including the api.baseUrl same-origin
        // check — so a successful parse implies packageWithinDomainScope; no
        // separate call is needed here.
        const parsed = webMcpPackageSchema.safeParse(body);
        if (!parsed.success) return { ok: false, reason: "invalid-body" };
        const pkg = parsed.data;

        const index = await readIndex();
        const previous = index[pkg.id];
        const entry: IndexEntry = {
          packageId: pkg.id,
          versionId: pkg.versionId,
          version: pkg.version,
          domain: pkg.domain,
          urlPatterns: pkg.urlPatterns,
          title: pkg.title,
          ...(pkg.minEngine !== undefined ? { minEngine: pkg.minEngine } : {}),
          installedAt: (options.now?.() ?? new Date()).toISOString(),
          source: options.source,
          origin: options.origin,
        };

        // The raw body is stored, not the zod output — parsing strips unknown
        // keys, and disk must stay byte-identical to what the registry served.
        await area.set({
          [SCHEMA_VERSION_KEY]: STORAGE_SCHEMA_VERSION,
          [pkgKey(pkg.id)]: body,
          [INDEX_KEY]: { ...index, [pkg.id]: entry },
        });

        return {
          ok: true,
          entry,
          ...(previous !== undefined
            ? { replaced: { versionId: previous.versionId, version: previous.version } }
            : {}),
        };
      });
    },

    uninstall(packageId: string): Promise<UninstallResult> {
      return enqueue(async () => {
        const state = await readSchemaVersionState();
        if (state !== "ok") return { ok: false, reason: "schema-unreadable" };

        const index = await readIndex();
        if (index[packageId] === undefined) return { ok: false, reason: "not-installed" };
        const next = { ...index };
        delete next[packageId];

        await area.set({ [INDEX_KEY]: next });
        await area.remove(pkgKey(packageId));
        return { ok: true };
      });
    },

    async loadPackage(packageId: string): Promise<LoadPackageResult> {
      const key = pkgKey(packageId);
      const raw = (await area.get(key))[key];
      if (raw === undefined) return { status: "missing" };
      // See install()'s comment: a successful parse already covers domain scope.
      const parsed = webMcpPackageSchema.safeParse(raw);
      return parsed.success ? { status: "ok", body: parsed.data } : { status: "invalid" };
    },

    collectOrphans(): Promise<string[]> {
      // Queued so GC's get-then-remove can't race an install and reclaim a
      // body that gained an index entry in between.
      return enqueue(collectOrphansInner);
    },
  };
}
