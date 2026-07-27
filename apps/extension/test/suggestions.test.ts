import { describe, expect, it } from "vitest";
import { webMcpPackageSchema, type WebMcpPackage } from "@robertn702/webmcp-cafe-schema";
import { fetchSuggestions } from "../src/lib/suggestions.js";

const ORIGIN = "https://registry.test";

function fetchStub(response: unknown | "network-error" | number) {
  const calls: string[] = [];
  return {
    calls,
    fetchFn: async (url: string) => {
      calls.push(url);
      if (response === "network-error") throw new Error("network down");
      if (typeof response === "number") return new Response("nope", { status: response });
      return new Response(JSON.stringify(response), { status: 200 });
    },
  };
}

function pkg(id: string): WebMcpPackage {
  return webMcpPackageSchema.parse({
    id,
    versionId: `${id}-v1`,
    version: 1,
    contributor: "someone",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    domain: "example.com",
    urlPatterns: ["*://example.com/*"],
    title: `Package ${id}`,
    description: "Fixture package",
    tools: [
      {
        name: "fixture_tool",
        description: "Fixture tool",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });
}

describe("fetchSuggestions", () => {
  it("requests pageSize=6 from the given origin and maps the package list", async () => {
    const { fetchFn, calls } = fetchStub({
      packages: [pkg("a"), pkg("b")],
      total: 2,
      page: 1,
      pageSize: 6,
    });

    const result = await fetchSuggestions({ fetchFn, origin: ORIGIN });

    expect(calls).toEqual([`${ORIGIN}/api/packages?pageSize=6`]);
    expect(result).toEqual({
      ok: true,
      packages: [
        {
          packageId: "a",
          versionId: "a-v1",
          version: 1,
          title: "Package a",
          domain: "example.com",
        },
        {
          packageId: "b",
          versionId: "b-v1",
          version: 1,
          title: "Package b",
          domain: "example.com",
        },
      ],
    });
  });

  // Distinct from "the registry has nothing to suggest" — that case returns
  // `{ ok: true, packages: [] }` via the empty-list branch below.
  it("reports failure distinctly when offline, never a silent empty list", async () => {
    const { fetchFn } = fetchStub("network-error");
    expect(await fetchSuggestions({ fetchFn, origin: ORIGIN })).toEqual({ ok: false });
  });

  it("reports failure on a non-2xx response", async () => {
    const { fetchFn } = fetchStub(503);
    expect(await fetchSuggestions({ fetchFn, origin: ORIGIN })).toEqual({ ok: false });
  });

  it("reports failure on a schema mismatch", async () => {
    const { fetchFn } = fetchStub({ nonsense: true });
    expect(await fetchSuggestions({ fetchFn, origin: ORIGIN })).toEqual({ ok: false });
  });

  it("succeeds with an empty array when the registry genuinely has nothing", async () => {
    const { fetchFn } = fetchStub({ packages: [], total: 0, page: 1, pageSize: 6 });
    expect(await fetchSuggestions({ fetchFn, origin: ORIGIN })).toEqual({ ok: true, packages: [] });
  });
});
