import { curatedPackages } from "@webmcp-today/curated-packages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postVersion } from "@/app/api/packages/[id]/versions/route";
import { POST as postPackage } from "@/app/api/packages/route";

// Publishing is where the submission grant attaches, and an agent POSTing to
// the API never sees the notice on /submit. So both publish routes have to hand
// back the terms they just accepted on the caller's behalf. There is no test
// database here: everything the routes touch is mocked so the response contract
// is what gets exercised.
const state = vi.hoisted((): { userId: string | null } => ({ userId: "user-1" }));

vi.mock("@/lib/api-auth", () => ({
  getAuthUserId: () => Promise.resolve(state.userId),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ id: "pkg-1", contributorId: "user-1" }]) }),
      }),
    }),
  },
}));

vi.mock("@/lib/mutations", () => ({
  insertPackage: () => Promise.resolve({ packageId: "pkg-1" }),
  publishVersion: () => Promise.resolve({ versionId: "ver-2", version: 2 }),
}));

const pkg = curatedPackages[0];
if (!pkg) throw new Error("expected at least one curated package to publish in this test");

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("publish routes — submission terms", () => {
  beforeEach(() => {
    state.userId = "user-1";
  });

  it("returns the terms alongside a new package", async () => {
    const response = await postPackage(post("https://webmcp.today/api/packages", pkg));
    expect(response.status).toBe(201);
    expect(response.headers.get("Link")).toBe(
      '<https://webmcp.today/terms>; rel="terms-of-service"',
    );
    expect(response.headers.get("Location")).toBe("https://webmcp.today/api/packages/pkg-1");
    await expect(response.json()).resolves.toEqual({
      id: "pkg-1",
      terms: "https://webmcp.today/terms",
    });
  });

  it("returns the terms alongside a new version", async () => {
    const response = await postVersion(
      post("https://webmcp.today/api/packages/pkg-1/versions", {
        urlPatterns: pkg.urlPatterns,
        tools: pkg.tools,
        api: pkg.api,
      }),
      { params: Promise.resolve({ id: "pkg-1" }) },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("Link")).toBe(
      '<https://webmcp.today/terms>; rel="terms-of-service"',
    );
    expect(response.headers.get("Location")).toBe(
      "https://webmcp.today/api/packages/pkg-1/versions/ver-2",
    );
    await expect(response.json()).resolves.toEqual({
      versionId: "ver-2",
      version: 2,
      terms: "https://webmcp.today/terms",
    });
  });

  it("links the terms of the host that accepted the submission", async () => {
    const response = await postPackage(post("http://localhost:3000/api/packages", pkg));
    expect(response.headers.get("Link")).toBe(
      '<http://localhost:3000/terms>; rel="terms-of-service"',
    );
  });
});
