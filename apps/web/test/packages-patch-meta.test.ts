import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/packages/[id]/route";

// `domain` is the package's immutable identity — it is set once at creation
// and can never be patched, so PATCH only has to accept title/description.
// There is no test database here: the route's data access is mocked so the
// metadata-only contract itself is what gets exercised.
const state = vi.hoisted(
  (): {
    userId: string | null;
    packageRows: { id: string; contributorId: string }[];
    updates: { title?: string; description?: string }[];
  } => ({
    userId: "user-1",
    packageRows: [{ id: "pkg-1", contributorId: "user-1" }],
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
}));

vi.mock("@/lib/mutations", () => ({
  updatePackageMeta: (_id: string, meta: { title?: string; description?: string }) => {
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

describe("PATCH /api/packages/:id — metadata is title/description only", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.packageRows = [{ id: "pkg-1", contributorId: "user-1" }];
    state.updates = [];
  });

  it("updates title and description", async () => {
    const response = await patch({ title: "Renamed", description: "New description" });
    expect(response.status).toBe(200);
    expect(state.updates).toEqual([{ title: "Renamed", description: "New description" }]);
  });

  it("rejects a domain field — the package's visible scope is immutable after creation", async () => {
    const response = await patch({ domain: "ycombinator.com" });
    expect(response.status).toBe(400);
    expect(state.updates).toEqual([]);
  });

  it("403s when the caller is not the contributor", async () => {
    state.packageRows = [{ id: "pkg-1", contributorId: "someone-else" }];
    const response = await patch({ title: "Renamed" });
    expect(response.status).toBe(403);
  });

  it("401s when unauthenticated", async () => {
    state.userId = null;
    const response = await patch({ title: "Renamed" });
    expect(response.status).toBe(401);
  });
});
