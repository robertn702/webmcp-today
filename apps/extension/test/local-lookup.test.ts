import { describe, expect, it } from "vitest";
import { createInstallsStore, type InstallOptions } from "../src/lib/installs-store.js";
import { resolveLocalLookup } from "../src/lib/local-lookup.js";
import {
  REVOKED_KEY,
  SCHEMA_VERSION_KEY,
  pkgKey,
  type RevokedDoc,
} from "../src/lib/store-schema.js";
import { createFakeStorageArea, type FakeStorageArea } from "./fake-storage-area.js";
import type { RevocationEntry } from "@robertn702/webmcp-today-schema";
import { apiContentHash } from "@robertn702/webmcp-today-schema";

const OPTS: InstallOptions = { source: "registry", origin: "https://webmcp.today" };
const PAGE_URL = "https://en.wikipedia.org/wiki/Coffee";

const API_BLOCK = {
  baseUrl: "https://en.wikipedia.org",
  endpoints: { summary: { method: "GET", path: "/api/summary" } },
};

function servedPackage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "pkg-wiki",
    versionId: "ver-1",
    version: 1,
    domain: "en.wikipedia.org",
    urlPatterns: ["*://en.wikipedia.org/wiki/*"],
    title: "Wikipedia article",
    description: "Fixture package",
    contributor: "robert",
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    tools: [
      {
        name: "wiki_summary",
        description: "wiki_summary fixture tool",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
        execution: { mode: "api", endpoint: "summary" },
      },
    ],
    api: API_BLOCK,
    apiContentHash: apiContentHash(API_BLOCK),
    ...overrides,
  };
}

function emptyRevokedDoc(entries: RevocationEntry[] = []): RevokedDoc {
  return { cursor: 0, fetchedAt: "2026-07-27T00:00:00.000Z", entries };
}

async function seededStore(area: FakeStorageArea): Promise<ReturnType<typeof createInstallsStore>> {
  const store = createInstallsStore(area);
  const result = await store.install(servedPackage(), OPTS);
  expect(result.ok).toBe(true);
  return store;
}

describe("resolveLocalLookup", () => {
  // Risk R4: the fail-closed bootstrap decision — a never-fetched revocation
  // list means NOTHING registers, and the diagnostics must say why (the
  // popup/badge turn that into "paused, waiting on the safety list").
  it("serves nothing with blocked=no-revocation-list when the safety list was never fetched", async () => {
    const area = createFakeStorageArea();
    const store = await seededStore(area);

    const result = await resolveLocalLookup(PAGE_URL, store, area);

    expect(result.packages).toEqual([]);
    expect(result.diagnostics).toEqual({
      matched: 0,
      revoked: 0,
      broken: 0,
      blocked: "no-revocation-list",
    });
  });

  it("serves nothing with blocked=storage-unreadable when storage was written by a newer build", async () => {
    const area = createFakeStorageArea();
    const store = await seededStore(area);
    await area.set({ [SCHEMA_VERSION_KEY]: 999 });
    await area.set({ [REVOKED_KEY]: emptyRevokedDoc() });

    const result = await resolveLocalLookup(PAGE_URL, store, area);

    expect(result.packages).toEqual([]);
    expect(result.diagnostics.blocked).toBe("storage-unreadable");
  });

  it("serves a matching installed package once the safety list is present", async () => {
    const area = createFakeStorageArea();
    const store = await seededStore(area);
    await area.set({ [REVOKED_KEY]: emptyRevokedDoc() });

    const result = await resolveLocalLookup(PAGE_URL, store, area);

    expect(result.packages.map((p) => p.id)).toEqual(["pkg-wiki"]);
    expect(result.diagnostics).toEqual({ matched: 1, revoked: 0, broken: 0 });
  });

  it("returns an empty match (not blocked) for a URL no install covers", async () => {
    const area = createFakeStorageArea();
    const store = await seededStore(area);
    await area.set({ [REVOKED_KEY]: emptyRevokedDoc() });

    const result = await resolveLocalLookup("https://reddit.com/r/coffee", store, area);

    expect(result.packages).toEqual([]);
    expect(result.diagnostics).toEqual({ matched: 0, revoked: 0, broken: 0 });
  });

  it("drops a whole-package revocation and counts it in diagnostics", async () => {
    const area = createFakeStorageArea();
    const store = await seededStore(area);
    await area.set({
      [REVOKED_KEY]: emptyRevokedDoc([
        {
          id: 1,
          packageId: "pkg-wiki",
          versionId: null,
          reason: "malware",
          revokedAt: "2026-07-27T00:00:00.000Z",
        },
      ]),
    });

    const result = await resolveLocalLookup(PAGE_URL, store, area);

    expect(result.packages).toEqual([]);
    expect(result.diagnostics).toEqual({ matched: 1, revoked: 1, broken: 0 });
  });

  it("keeps an install whose revocation targets a different version", async () => {
    const area = createFakeStorageArea();
    const store = await seededStore(area);
    await area.set({
      [REVOKED_KEY]: emptyRevokedDoc([
        {
          id: 1,
          packageId: "pkg-wiki",
          versionId: "ver-2",
          reason: "bad selector in v2",
          revokedAt: "2026-07-27T00:00:00.000Z",
        },
      ]),
    });

    const result = await resolveLocalLookup(PAGE_URL, store, area);

    expect(result.packages.map((p) => p.id)).toEqual(["pkg-wiki"]);
    expect(result.diagnostics).toEqual({ matched: 1, revoked: 0, broken: 0 });
  });

  it("drops an install whose stored body is unreadable and counts it broken", async () => {
    const area = createFakeStorageArea();
    const store = await seededStore(area);
    await area.set({ [REVOKED_KEY]: emptyRevokedDoc() });
    await area.set({ [pkgKey("pkg-wiki")]: { garbage: true } });

    const result = await resolveLocalLookup(PAGE_URL, store, area);

    expect(result.packages).toEqual([]);
    expect(result.diagnostics).toEqual({ matched: 1, revoked: 0, broken: 1 });
  });
});
