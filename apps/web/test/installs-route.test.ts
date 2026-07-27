import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/installs/route";

// The caller's pinned packages, auth-only. No test database: the repo layer is
// mocked so the auth gate and pass-through are what get exercised.
const state = vi.hoisted((): { userId: string | null; packages: { id: string }[] } => ({
  userId: "user-1",
  packages: [{ id: "pkg-1" }, { id: "pkg-2" }],
}));

vi.mock("@/lib/api-auth", () => ({
  getAuthUserId: () => Promise.resolve(state.userId),
}));

vi.mock("@/lib/packages-repo", () => ({
  getInstalledPackages: () => Promise.resolve(state.packages),
}));

function get(): Promise<Response> {
  return GET(new Request("https://webmcp.cafe/api/installs"));
}

describe("GET /api/installs", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.packages = [{ id: "pkg-1" }, { id: "pkg-2" }];
  });

  it("returns the caller's pinned packages", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      packages: [{ id: "pkg-1" }, { id: "pkg-2" }],
    });
  });

  it("401s when unauthenticated", async () => {
    state.userId = null;
    const response = await get();
    expect(response.status).toBe(401);
  });
});
