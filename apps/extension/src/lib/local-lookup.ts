import { z } from "zod";
import type { WebMcpPackage } from "@webmcp-today/schema";
import type { InstallsStore } from "./installs-store.js";
import { findRevocation, matchInstalled } from "./match-installed.js";
import { readRevokedDoc } from "./revocations.js";
import type { StorageArea } from "./store-schema.js";

// The page-load decision, as a pure function over the local store: which
// installed packages may register on this URL, and if none, why. Fail-closed
// (risk R4): unreadable storage or a never-fetched revocation list means
// nothing registers — and the diagnostics say so, never a silent zero.

export const lookupBlockedSchema = z.enum([
  "no-revocation-list",
  "storage-unreadable",
  // Produced only by the content-side lookup client when the background does
  // not answer; resolveLocalLookup itself never returns this value.
  "lookup-failed",
]);
export type LookupBlocked = z.infer<typeof lookupBlockedSchema>;

export interface LookupDiagnostics {
  matched: number;
  revoked: number;
  broken: number;
  blocked?: LookupBlocked;
}

export interface LocalLookupResult {
  packages: WebMcpPackage[];
  diagnostics: LookupDiagnostics;
}

/** What `RegistrationDeps.loadPackages` resolves to on the content side. */
export interface PageLoadPackages {
  packages: WebMcpPackage[];
  blocked?: LookupBlocked;
}

export async function resolveLocalLookup(
  url: string,
  store: InstallsStore,
  area: StorageArea,
): Promise<LocalLookupResult> {
  const none = { matched: 0, revoked: 0, broken: 0 };

  const schemaState = await store.readSchemaVersionState();
  if (schemaState !== "ok") {
    return { packages: [], diagnostics: { ...none, blocked: "storage-unreadable" } };
  }

  const revokedDoc = await readRevokedDoc(area);
  if (revokedDoc === undefined) {
    return { packages: [], diagnostics: { ...none, blocked: "no-revocation-list" } };
  }

  const index = await store.readIndex();
  const matched = matchInstalled(index, url);

  let revoked = 0;
  let broken = 0;
  const packages: WebMcpPackage[] = [];
  for (const entry of matched) {
    if (findRevocation(revokedDoc.entries, entry) !== undefined) {
      revoked += 1;
      continue;
    }
    const loaded = await store.loadPackage(entry.packageId);
    if (loaded.status !== "ok") {
      broken += 1;
      continue;
    }
    packages.push(loaded.body);
  }

  return { packages, diagnostics: { matched: matched.length, revoked, broken } };
}
