import {
  BRIDGE_PROTOCOL_VERSION,
  ENGINE_VERSION,
  bridgeRequestSchema,
  webMcpPackageSchema,
  type BridgeInstallRequest,
  type BridgeInstallResponse,
  type BridgeListInstallsResponse,
  type BridgePingResponse,
  type BridgeUninstallResponse,
  type InstallState,
  type RevocationEntry,
} from "@webmcp-today/schema";
import { supportsPackageEngine } from "@webmcp-today/engine";
import type { InstallsStore, LoadPackageResult, SchemaVersionState } from "./installs-store.js";
import { findRevocation } from "./match-installed.js";
import { isAllowedRegistryOrigin } from "./registry-origins.js";
import { pollRevocations, readRevokedDoc } from "./revocations.js";
import type { IndexEntry, StorageArea } from "./store-schema.js";

// installPackage is exported (not just used by the switch below) so the
// popup's suggestion installs (background.ts) go through the identical
// fetch/hash/revocation/atomic-write path as a page-driven bridge install —
// only the origin and the resulting `source` tag differ.

// Page→extension bridge (docs/local-first-installs.md §4). The registry site
// talks to the background over runtime.onMessageExternal; this module is the
// trust boundary. The origin allowlist is checked first, every message is
// zod-validated, and the package body is fetched from the SENDER's origin
// (never a build-time constant), so one build serves dev and prod.
// Fail-closed throughout: anything unverifiable refuses with a distinct
// reason and writes nothing.

export interface BridgeDeps {
  store: InstallsStore;
  area: StorageArea;
  fetchFn: (url: string) => Promise<Response>;
  extensionVersion: string;
  ensureInitialized: () => Promise<SchemaVersionState>;
}

/** Shared by the bridge's list-installs and the popup: one install's state
 *  derived from the revocation list, its stored body, and the engine gate. */
export function resolveInstallState(
  entry: IndexEntry,
  revocation: RevocationEntry | undefined,
  loaded: LoadPackageResult,
): InstallState {
  if (revocation !== undefined) return "revoked";
  if (loaded.status !== "ok") return "broken";
  if (!supportsPackageEngine(entry)) return "engine-too-old";
  return "ok";
}

/**
 * Handle one external message. Returns the response to send, or undefined to
 * not respond at all (non-allowlisted origin — the manifest's
 * externally_connectable should already have filtered it, so a sender that
 * reaches here gets silence, not an error it can probe).
 */
export async function handleBridgeRequest(
  message: unknown,
  senderOrigin: string | undefined,
  deps: BridgeDeps,
): Promise<unknown> {
  if (senderOrigin === undefined || !isAllowedRegistryOrigin(senderOrigin)) return undefined;
  const origin = senderOrigin;

  const parsed = bridgeRequestSchema.safeParse(message);
  if (!parsed.success) return { ok: false, reason: "bad-request" };

  switch (parsed.data.type) {
    case "ping":
      return handlePing(deps);
    case "install":
      return installPackage(parsed.data, origin, deps, "registry");
    case "uninstall":
      return handleUninstall(parsed.data.packageId, deps);
    case "list-installs":
      return handleListInstalls(deps);
  }
}

async function handlePing(deps: BridgeDeps): Promise<BridgePingResponse> {
  const schemaState = await deps.ensureInitialized();
  return {
    ok: true,
    protocol: BRIDGE_PROTOCOL_VERSION,
    engine: ENGINE_VERSION,
    extensionVersion: deps.extensionVersion,
    storageReadable: schemaState === "ok",
  };
}

export async function installPackage(
  request: BridgeInstallRequest,
  origin: string,
  deps: BridgeDeps,
  source: IndexEntry["source"],
): Promise<BridgeInstallResponse> {
  const schemaState = await deps.ensureInitialized();
  if (schemaState !== "ok") return { ok: false, reason: "storage-unreadable" };

  let raw: unknown;
  try {
    const response = await deps.fetchFn(
      `${origin}/api/packages/${request.packageId}/versions/${request.versionId}`,
    );
    if (response.status === 404) return { ok: false, reason: "not-found" };
    if (!response.ok) return { ok: false, reason: "network" };
    raw = await response.json();
  } catch {
    return { ok: false, reason: "network" };
  }

  const parsedBody = webMcpPackageSchema.safeParse(raw);
  if (!parsedBody.success) return { ok: false, reason: "invalid-body" };
  const pkg = parsedBody.data;

  // The page chose both ids; a registry serving anything else is refused
  // rather than silently absorbed.
  if (pkg.id !== request.packageId || pkg.versionId !== request.versionId) {
    return { ok: false, reason: "id-mismatch" };
  }

  // Fail-closed bootstrap: the first install is what can bring the kill list
  // into existence. If it can't be fetched, nothing is written.
  let revokedDoc = await readRevokedDoc(deps.area);
  if (revokedDoc === undefined) {
    const poll = await pollRevocations({ area: deps.area, fetchFn: deps.fetchFn, origin });
    if (!poll.ok) return { ok: false, reason: "revocation-unavailable" };
    revokedDoc = poll.doc;
  }
  if (findRevocation(revokedDoc.entries, request) !== undefined) {
    return { ok: false, reason: "revoked" };
  }

  try {
    const result = await deps.store.install(raw, { source, origin });
    if (!result.ok) {
      if (result.reason === "schema-unreadable") {
        return { ok: false, reason: "storage-unreadable" };
      }
      return { ok: false, reason: result.reason };
    }
    return {
      ok: true,
      packageId: result.entry.packageId,
      versionId: result.entry.versionId,
      version: result.entry.version,
      ...(result.replaced !== undefined ? { replaced: result.replaced } : {}),
    };
  } catch {
    // area.set rejects on quota/IO failure; the atomic batch means nothing
    // was written.
    return { ok: false, reason: "quota" };
  }
}

async function handleUninstall(
  packageId: string,
  deps: BridgeDeps,
): Promise<BridgeUninstallResponse> {
  const schemaState = await deps.ensureInitialized();
  if (schemaState !== "ok") return { ok: false, reason: "storage-unreadable" };

  try {
    const result = await deps.store.uninstall(packageId);
    if (result.ok) return { ok: true };
    return {
      ok: false,
      reason: result.reason === "not-installed" ? "not-installed" : "storage-unreadable",
    };
  } catch {
    // uninstall can throw AFTER its index removal committed — re-read rather
    // than assume failure (same contract the popup's uninstall follows).
    const index = await deps.store.readIndex();
    return index[packageId] === undefined
      ? { ok: true }
      : { ok: false, reason: "storage-unreadable" };
  }
}

async function handleListInstalls(deps: BridgeDeps): Promise<BridgeListInstallsResponse> {
  const schemaState = await deps.ensureInitialized();
  // Unreadable storage reads as empty (same posture as the store's
  // corrupt-index rule); ping's storageReadable is the distinct signal.
  if (schemaState !== "ok") return { ok: true, installs: [] };

  const index = await deps.store.readIndex();
  const revokedDoc = await readRevokedDoc(deps.area);
  const installs: BridgeListInstallsResponse["installs"] = [];
  for (const entry of Object.values(index)) {
    const revocation =
      revokedDoc === undefined ? undefined : findRevocation(revokedDoc.entries, entry);
    const loaded = await deps.store.loadPackage(entry.packageId);
    installs.push({
      packageId: entry.packageId,
      versionId: entry.versionId,
      version: entry.version,
      title: entry.title,
      domain: entry.domain,
      installedAt: entry.installedAt,
      state: resolveInstallState(entry, revocation, loaded),
    });
  }
  return { ok: true, installs };
}
