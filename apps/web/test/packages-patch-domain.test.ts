import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/packages/[id]/route";

// `domain` (the lookup key) lives on the package row while urlPatterns are
// version-scoped, so a metadata PATCH is the one surface that can move a domain
// off the patterns publish-time validation already enforces. There is no test
// database here: the route's data access is mocked so the guard itself is what
// gets exercised.
const state = vi.hoisted(
  (): {
    userId: string | null;
    packageRows: { id: string; contributorId: string }[];
    latest: { urlPatterns: string[] } | null;
    updates: { domain?: string; title?: string }[];
  } => ({
    userId: "user-1",
    packageRows: [{ id: "pkg-1", contributorId: "user-1" }],
    latest: { urlPatterns: ["*://*.reddit.com/*"] },
    updates: [],
  }),
);

vi.mock("@/lib/api-auth", () => ({
  getAuthUserId: () => Promise.resolve(state.userId),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(state.packageRows) }),
      }),
    }),
  },
}));

vi.mock("@/lib/packages-repo", () => ({
  getPackageById: () => Promise.resolve({ id: "pkg-1", domain: "reddit.com" }),
  getLatestVersion: () => Promise.resolve(state.latest),
}));

vi.mock("@/lib/mutations", () => ({
  updatePackageMeta: (_id: string, meta: { domain?: string; title?: string }) => {
    state.updates.push(meta);
    return Promise.resolve();
  },
}));

function patch(body: unknown): Promise<Response> {
  return PATCH(
    new Request("https://webmcp.today/api/packages/pkg-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "pkg-1" }) },
  );
}

describe("PATCH /api/packages/:id — domain coverage guard", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.packageRows = [{ id: "pkg-1", contributorId: "user-1" }];
    state.latest = { urlPatterns: ["*://*.reddit.com/*"] };
    state.updates = [];
  });

  it("rejects a domain the latest version's urlPatterns do not cover", async () => {
    const response = await patch({ domain: "example.com" });
    expect(response.status).toBe(422);
    expect(state.updates).toEqual([]);
  });

  it("rejects narrowing the visible domain while a wildcard still covers sibling subdomains", async () => {
    const response = await patch({ domain: "old.reddit.com" });
    expect(response.status).toBe(422);
    expect(state.updates).toEqual([]);
  });

  it("accepts the apex domain a *.host pattern covers", async () => {
    const response = await patch({ domain: "reddit.com" });
    expect(response.status).toBe(200);
    expect(state.updates).toEqual([{ domain: "reddit.com" }]);
  });

  it("checks the normalized domain, not the raw input", async () => {
    const response = await patch({ domain: "WWW.Reddit.com" });
    expect(response.status).toBe(200);
    expect(state.updates).toEqual([{ domain: "reddit.com" }]);
  });

  it("skips the guard for edits that do not touch domain", async () => {
    state.latest = { urlPatterns: ["*://example.org/*"] };
    const response = await patch({ title: "Renamed" });
    expect(response.status).toBe(200);
    expect(state.updates).toEqual([{ title: "Renamed" }]);
  });
});
