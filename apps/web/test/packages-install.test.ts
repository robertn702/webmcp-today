import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "@/app/api/packages/[id]/install/route";

// PUT collapses the old POST install + POST update into one idempotent call:
// it creates the pin if absent and moves it if present (also how rollback
// works — pass an older versionId). There is no test database here: the repo
// and mutation layers are mocked so that create-or-move behaviour is what
// gets exercised.
const API_BLOCK = { baseUrl: "https://acme.com" };

const state = vi.hoisted(
  (): {
    userId: string | null;
    packageExists: boolean;
    latest: {
      id: string;
      version: number;
      urlPatterns: string[];
      api: { baseUrl: string };
    } | null;
    versionsById: Record<
      string,
      { id: string; version: number; urlPatterns: string[]; api: { baseUrl: string } }
    >;
    installs: { userId: string; packageId: string; versionId: string }[];
  } => ({
    userId: "user-1",
    packageExists: true,
    // Placeholder only — every test's beforeEach overwrites this before use.
    // vi.hoisted's factory runs before module-scope consts, so it can't
    // reference API_BLOCK; this literal must stay a well-formed https:// URL,
    // not an empty string, so a future test can't be misled by an invalid one.
    latest: {
      id: "ver-2",
      version: 2,
      urlPatterns: ["*://acme.com/*"],
      api: { baseUrl: "https://acme.com" },
    },
    versionsById: {},
    installs: [],
  }),
);

vi.mock("@/lib/api-auth", () => ({
  getAuthUserId: () => Promise.resolve(state.userId),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve(state.packageExists ? [{ id: "pkg-1", domain: "acme.com" }] : []),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/packages-repo", () => ({
  getLatestVersion: () => Promise.resolve(state.latest),
  getVersionById: (_id: string, versionId: string) =>
    Promise.resolve(state.versionsById[versionId] ?? null),
}));

vi.mock("@/lib/mutations", () => ({
  installPackage: (userId: string, packageId: string, versionId: string) => {
    const existing = state.installs.find((i) => i.userId === userId && i.packageId === packageId);
    if (existing) existing.versionId = versionId;
    else state.installs.push({ userId, packageId, versionId });
    return Promise.resolve();
  },
  uninstallPackage: (userId: string, packageId: string) => {
    const before = state.installs.length;
    state.installs = state.installs.filter(
      (i) => !(i.userId === userId && i.packageId === packageId),
    );
    return Promise.resolve(state.installs.length < before);
  },
}));

function put(id: string, body: unknown): Promise<Response> {
  return PUT(
    new Request(`https://webmcp.today/api/packages/${id}/install`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function del(id: string): Promise<Response> {
  return DELETE(
    new Request(`https://webmcp.today/api/packages/${id}/install`, { method: "DELETE" }),
    {
      params: Promise.resolve({ id }),
    },
  );
}

describe("PUT /api/packages/:id/install", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.packageExists = true;
    state.latest = { id: "ver-2", version: 2, urlPatterns: ["*://acme.com/*"], api: API_BLOCK };
    state.versionsById = {
      "ver-1": { id: "ver-1", version: 1, urlPatterns: ["*://acme.com/*"], api: API_BLOCK },
      "ver-2": { id: "ver-2", version: 2, urlPatterns: ["*://acme.com/*"], api: API_BLOCK },
    };
    state.installs = [];
  });

  it("creates a pin at latest when none exists", async () => {
    const response = await put("pkg-1", {});
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, versionId: "ver-2", version: 2 });
    expect(state.installs).toEqual([{ userId: "user-1", packageId: "pkg-1", versionId: "ver-2" }]);
  });

  it("moves an existing pin to a different version (rollback)", async () => {
    await put("pkg-1", {});
    const response = await put("pkg-1", { versionId: "ver-1" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, versionId: "ver-1", version: 1 });
    expect(state.installs).toEqual([{ userId: "user-1", packageId: "pkg-1", versionId: "ver-1" }]);
  });

  it("404s when the package does not exist", async () => {
    state.packageExists = false;
    const response = await put("pkg-nope", {});
    expect(response.status).toBe(404);
  });

  it("404s when the requested version does not exist", async () => {
    const response = await put("pkg-1", { versionId: "ver-9" });
    expect(response.status).toBe(404);
  });

  it("does not pin a legacy version that exceeds the package domain", async () => {
    state.versionsById["ver-legacy"] = {
      id: "ver-legacy",
      version: 3,
      urlPatterns: ["*://*/*"],
      api: API_BLOCK,
    };
    const response = await put("pkg-1", { versionId: "ver-legacy" });
    expect(response.status).toBe(404);
    expect(state.installs).toEqual([]);
  });

  it("401s when unauthenticated", async () => {
    state.userId = null;
    const response = await put("pkg-1", {});
    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/packages/:id/install", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.installs = [{ userId: "user-1", packageId: "pkg-1", versionId: "ver-2" }];
  });

  it("removes an existing pin", async () => {
    const response = await del("pkg-1");
    expect(response.status).toBe(200);
    expect(state.installs).toEqual([]);
  });

  it("404s when not installed", async () => {
    const response = await del("pkg-nope");
    expect(response.status).toBe(404);
  });
});
