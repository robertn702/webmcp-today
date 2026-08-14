import { curatedPackages } from "@webmcp-today/curated-packages";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postVersion } from "@/app/api/packages/[id]/versions/route";
import { POST as postPackage } from "@/app/api/packages/route";
import { withLlmsLink } from "@/lib/http";
import { SUBMISSION_TERMS_HEADER, SUBMISSION_TERMS_VERSION } from "@/lib/submission-terms";

const LLMS_LINK = '</llms.txt>; rel="describedby"';

// Publishing is where the submission grant attaches, and an agent POSTing to
// the API never sees the notice on /submit. So both publish routes have to hand
// back the terms they just accepted on the caller's behalf. There is no test
// database here: everything the routes touch is mocked so the response contract
// is what gets exercised.
const state = vi.hoisted(
  (): { userId: string | null; authCalls: number; insertCalls: number; publishCalls: number } => ({
    userId: "user-1",
    authCalls: 0,
    insertCalls: 0,
    publishCalls: 0,
  }),
);

vi.mock("@/lib/api-auth", () => ({
  getAuthUserId: () => {
    state.authCalls += 1;
    return Promise.resolve(state.userId);
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([{ id: "pkg-1", contributorId: "user-1", domain: "reddit.com" }]),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/mutations", () => ({
  insertPackage: () => {
    state.insertCalls += 1;
    return Promise.resolve({ packageId: "pkg-1" });
  },
  publishVersion: () => {
    state.publishCalls += 1;
    return Promise.resolve({ versionId: "ver-2", version: 2 });
  },
}));

const pkg = curatedPackages[0];
if (!pkg) throw new Error("expected at least one curated package to publish in this test");

function post(url: string, body: unknown, termsVersion?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (termsVersion) headers[SUBMISSION_TERMS_HEADER] = termsVersion;
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("publish routes — submission terms", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.authCalls = 0;
    state.insertCalls = 0;
    state.publishCalls = 0;
  });

  it("adds discovery metadata without replacing an existing Link relation", () => {
    const response = NextResponse.json(
      {},
      {
        headers: { Link: '<https://webmcp.today/other>; rel="alternate"' },
      },
    );
    expect(withLlmsLink(response).headers.get("Link")).toBe(
      `${LLMS_LINK}, <https://webmcp.today/other>; rel="alternate"`,
    );
  });

  it.each([
    ["a missing", undefined],
    ["a stale", "2026-08-07"],
  ])("rejects %s terms version before creating a package", async (_label, termsVersion) => {
    const response = await postPackage(
      post("https://webmcp.today/api/packages", pkg, termsVersion),
    );
    expect(response.status).toBe(428);
    expect(response.headers.get("Link")).toBe(
      '</llms.txt>; rel="describedby", <https://webmcp.today/terms>; rel="terms-of-service"',
    );
    await expect(response.json()).resolves.toEqual({
      error: `Accept the current terms by sending ${SUBMISSION_TERMS_HEADER}: ${SUBMISSION_TERMS_VERSION}`,
      termsVersion: SUBMISSION_TERMS_VERSION,
      terms: "https://webmcp.today/terms",
    });
    expect(state.authCalls).toBe(0);
    expect(state.insertCalls).toBe(0);
  });

  it("accepts the current terms version and returns it alongside a new package", async () => {
    const response = await postPackage(
      post("https://webmcp.today/api/packages", pkg, SUBMISSION_TERMS_VERSION),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("Link")).toBe(
      '</llms.txt>; rel="describedby", <https://webmcp.today/terms>; rel="terms-of-service"',
    );
    expect(response.headers.get("Location")).toBe("https://webmcp.today/api/packages/pkg-1");
    await expect(response.json()).resolves.toEqual({
      id: "pkg-1",
      terms: "https://webmcp.today/terms",
    });
    expect(state.authCalls).toBe(1);
    expect(state.insertCalls).toBe(1);
  });

  it.each([
    ["a missing", undefined],
    ["a stale", "2026-08-07"],
  ])("rejects %s terms version before publishing a new version", async (_label, termsVersion) => {
    const response = await postVersion(
      post(
        "https://webmcp.today/api/packages/pkg-1/versions",
        {
          version: 2,
          urlPatterns: pkg.urlPatterns,
          tools: pkg.tools,
          api: pkg.api,
          minEngine: pkg.minEngine,
        },
        termsVersion,
      ),
      { params: Promise.resolve({ id: "pkg-1" }) },
    );
    expect(response.status).toBe(428);
    expect(response.headers.get("Link")).toBe(
      '</llms.txt>; rel="describedby", <https://webmcp.today/terms>; rel="terms-of-service"',
    );
    expect(state.authCalls).toBe(0);
    expect(state.publishCalls).toBe(0);
  });

  it("accepts the current terms version and returns it alongside a new version", async () => {
    const response = await postVersion(
      post(
        "https://webmcp.today/api/packages/pkg-1/versions",
        {
          version: 2,
          urlPatterns: pkg.urlPatterns,
          tools: pkg.tools,
          api: pkg.api,
          minEngine: pkg.minEngine,
        },
        SUBMISSION_TERMS_VERSION,
      ),
      { params: Promise.resolve({ id: "pkg-1" }) },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("Link")).toBe(
      '</llms.txt>; rel="describedby", <https://webmcp.today/terms>; rel="terms-of-service"',
    );
    expect(response.headers.get("Location")).toBe(
      "https://webmcp.today/api/packages/pkg-1/versions/ver-2",
    );
    await expect(response.json()).resolves.toEqual({
      versionId: "ver-2",
      version: 2,
      terms: "https://webmcp.today/terms",
    });
    expect(state.authCalls).toBe(1);
    expect(state.publishCalls).toBe(1);
  });

  it("links the terms of the host that accepted the submission", async () => {
    const response = await postPackage(
      post("http://localhost:3000/api/packages", pkg, SUBMISSION_TERMS_VERSION),
    );
    expect(response.headers.get("Link")).toBe(
      '</llms.txt>; rel="describedby", <http://localhost:3000/terms>; rel="terms-of-service"',
    );
  });
});
