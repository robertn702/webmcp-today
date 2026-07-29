import { describe, expect, it } from "vitest";
import type { RevocationEntry } from "@robertn702/webmcp-today-schema";
import { pollRevocations, readRevokedDoc } from "../src/lib/revocations.js";
import { REVOKED_KEY, type RevokedDoc } from "../src/lib/store-schema.js";
import { createFakeStorageArea } from "./fake-storage-area.js";

const ORIGIN = "https://registry.test";

function revocation(id: number, packageId = `pkg-${id}`): RevocationEntry {
  return {
    id,
    packageId,
    versionId: null,
    reason: `reason ${id}`,
    revokedAt: "2026-07-27T00:00:00.000Z",
  };
}

function doc(cursor: number, entries: RevocationEntry[]): RevokedDoc {
  return { cursor, fetchedAt: "2026-07-26T00:00:00.000Z", entries };
}

type FetchStub = {
  fetchFn: (url: string) => Promise<Response>;
  calls: string[];
};

/** Serves queued responses in order; "network-error" rejects, a number is a
 * bare HTTP status, anything else is a 200 JSON body. */
function fetchStub(...responses: Array<unknown | "network-error" | number>): FetchStub {
  const calls: string[] = [];
  const queue = [...responses];
  return {
    calls,
    fetchFn: async (url: string) => {
      calls.push(url);
      const next = queue.shift();
      if (next === "network-error") throw new Error("network down");
      if (typeof next === "number") return new Response("nope", { status: next });
      return new Response(JSON.stringify(next), { status: 200 });
    },
  };
}

describe("pollRevocations", () => {
  it("bootstraps from since=0 and stores the first doc", async () => {
    const area = createFakeStorageArea();
    const { fetchFn, calls } = fetchStub({
      cursor: 2,
      latest: 2,
      entries: [revocation(1), revocation(2)],
    });

    const result = await pollRevocations({ area, fetchFn, origin: ORIGIN });

    expect(calls).toEqual([`${ORIGIN}/api/revocations?since=0`]);
    expect(result).toMatchObject({ ok: true, reset: false });
    const stored = await readRevokedDoc(area);
    expect(stored?.cursor).toBe(2);
    expect(stored?.entries.map((e) => e.id)).toEqual([1, 2]);
  });

  it("advances the cursor and merges new entries onto the known list", async () => {
    const area = createFakeStorageArea({ [REVOKED_KEY]: doc(3, [revocation(3)]) });
    const { fetchFn, calls } = fetchStub({
      cursor: 5,
      latest: 5,
      entries: [revocation(4), revocation(5)],
    });

    const result = await pollRevocations({ area, fetchFn, origin: ORIGIN });

    expect(calls).toEqual([`${ORIGIN}/api/revocations?since=3`]);
    expect(result.ok).toBe(true);
    const stored = await readRevokedDoc(area);
    expect(stored?.cursor).toBe(5);
    expect(stored?.entries.map((e) => e.id)).toEqual([3, 4, 5]);
  });

  it("keeps the entries and cursor on an empty page echo", async () => {
    const area = createFakeStorageArea({ [REVOKED_KEY]: doc(3, [revocation(3)]) });
    const { fetchFn } = fetchStub({ cursor: 3, latest: 3, entries: [] });

    const result = await pollRevocations({ area, fetchFn, origin: ORIGIN });

    expect(result.ok).toBe(true);
    const stored = await readRevokedDoc(area);
    expect(stored?.cursor).toBe(3);
    expect(stored?.entries.map((e) => e.id)).toEqual([3]);
  });

  // Risk R3: a DB wipe restarts the bigserial, leaving the stored cursor ahead
  // of the server's `latest` — the client must reset to 0 and refetch or it
  // never sees another revocation.
  it("resets to 0 and refetches the whole feed when the stored cursor is ahead of latest", async () => {
    const area = createFakeStorageArea({
      [REVOKED_KEY]: doc(10, [revocation(9, "old-world"), revocation(10, "old-world-2")]),
    });
    const { fetchFn, calls } = fetchStub(
      { cursor: 10, latest: 2, entries: [] },
      { cursor: 2, latest: 2, entries: [revocation(1, "new-world"), revocation(2, "new-world-2")] },
    );

    const result = await pollRevocations({ area, fetchFn, origin: ORIGIN });

    expect(calls).toEqual([
      `${ORIGIN}/api/revocations?since=10`,
      `${ORIGIN}/api/revocations?since=0`,
    ]);
    expect(result).toMatchObject({ ok: true, reset: true });
    const stored = await readRevokedDoc(area);
    expect(stored?.cursor).toBe(2);
    // Old-world entries are replaced wholesale: their ids belong to the wiped
    // database and would collide with the new world's.
    expect(stored?.entries.map((e) => e.packageId)).toEqual(["new-world", "new-world-2"]);
  });

  it("keeps the old doc when the reset refetch fails", async () => {
    const before = doc(10, [revocation(9)]);
    const area = createFakeStorageArea({ [REVOKED_KEY]: before });
    const { fetchFn } = fetchStub({ cursor: 10, latest: 2, entries: [] }, "network-error");

    const result = await pollRevocations({ area, fetchFn, origin: ORIGIN });

    expect(result).toEqual({ ok: false });
    expect(await readRevokedDoc(area)).toEqual(before);
  });

  it.each([
    ["network error", "network-error"],
    ["non-2xx", 503],
    ["schema mismatch", { nonsense: true }],
  ])("keeps the old doc when the poll fails (%s)", async (_name, response) => {
    const before = doc(3, [revocation(3)]);
    const area = createFakeStorageArea({ [REVOKED_KEY]: before });
    const { fetchFn } = fetchStub(response);

    const result = await pollRevocations({ area, fetchFn, origin: ORIGIN });

    expect(result).toEqual({ ok: false });
    expect(await readRevokedDoc(area)).toEqual(before);
  });
});

describe("readRevokedDoc", () => {
  it("returns undefined when absent (the fail-closed gate)", async () => {
    expect(await readRevokedDoc(createFakeStorageArea())).toBeUndefined();
  });

  it("treats a corrupt doc as absent", async () => {
    const area = createFakeStorageArea({ [REVOKED_KEY]: { cursor: "what" } });
    expect(await readRevokedDoc(area)).toBeUndefined();
  });
});
