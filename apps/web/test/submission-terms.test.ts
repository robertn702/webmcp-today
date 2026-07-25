import { definitions } from "@webmcp-cafe/definitions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postVersion } from "@/app/api/configs/[id]/versions/route";
import { POST as postConfig } from "@/app/api/configs/route";

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
        where: () => ({ limit: () => Promise.resolve([{ id: "def-1", contributorId: "user-1" }]) }),
      }),
    }),
  },
}));

vi.mock("@/lib/mutations", () => ({
  insertDefinition: () => Promise.resolve({ definitionId: "def-1" }),
  publishVersion: () => Promise.resolve({ versionId: "ver-2", version: 2 }),
}));

const config = definitions[0];
if (!config) throw new Error("expected at least one curated definition to publish in this test");

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

  it("returns the terms alongside a new definition", async () => {
    const response = await postConfig(post("https://webmcp.cafe/api/configs", config));
    expect(response.status).toBe(201);
    expect(response.headers.get("Link")).toBe(
      '<https://webmcp.cafe/terms>; rel="terms-of-service"',
    );
    await expect(response.json()).resolves.toEqual({
      id: "def-1",
      terms: "https://webmcp.cafe/terms",
    });
  });

  it("returns the terms alongside a new version", async () => {
    const response = await postVersion(
      post("https://webmcp.cafe/api/configs/def-1/versions", {
        urlPatterns: config.urlPatterns,
        tools: config.tools,
        api: config.api,
      }),
      { params: Promise.resolve({ id: "def-1" }) },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("Link")).toBe(
      '<https://webmcp.cafe/terms>; rel="terms-of-service"',
    );
    await expect(response.json()).resolves.toEqual({
      versionId: "ver-2",
      version: 2,
      terms: "https://webmcp.cafe/terms",
    });
  });

  it("links the terms of the host that accepted the submission", async () => {
    const response = await postConfig(post("http://localhost:3000/api/configs", config));
    expect(response.headers.get("Link")).toBe(
      '<http://localhost:3000/terms>; rel="terms-of-service"',
    );
  });
});
