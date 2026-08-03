import { describe, expect, it } from "vitest";
import { webMcpPackageSchema, type WebMcpPackage } from "@robertn702/webmcp-today-schema";
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

function pkg(
  id: string,
  { domain = "example.com", urlPatterns = [`*://${domain}/*`] }: Partial<WebMcpPackage> = {},
): WebMcpPackage {
  return webMcpPackageSchema.parse({
    id,
    versionId: `${id}-v1`,
    version: 1,
    contributor: "someone",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    domain,
    urlPatterns,
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
  it("uses active-page lookup and excludes unrelated responses defensively", async () => {
    const calls: string[] = [];
    const matching = pkg("matching", {
      domain: "reddit.com",
      urlPatterns: ["*://*.reddit.com/r/*"],
    });
    const wrongPath = pkg("wrong-path", {
      domain: "reddit.com",
      urlPatterns: ["*://*.reddit.com/wiki/*"],
    });
    // The old unscoped request would have surfaced this globally newest package.
    const recentlyUpdatedElsewhere = pkg("recently-updated-elsewhere", {
      domain: "example.com",
    });
    const fetchFn = async (url: string) => {
      calls.push(url);
      const lookupUrl = new URL(url).searchParams.get("url");
      const packages =
        lookupUrl === "https://old.reddit.com/r/programming"
          ? [recentlyUpdatedElsewhere, wrongPath, matching]
          : [];
      return new Response(JSON.stringify({ packages }));
    };

    const result = await fetchSuggestions({
      fetchFn,
      origin: ORIGIN,
      url: "https://old.reddit.com/r/programming",
    });

    expect(calls).toEqual([
      `${ORIGIN}/api/packages/lookup?url=https%3A%2F%2Fold.reddit.com%2Fr%2Fprogramming`,
    ]);
    expect(result).toEqual({
      ok: true,
      packages: [
        {
          packageId: "matching",
          versionId: "matching-v1",
          version: 1,
          title: "Package matching",
          domain: "reddit.com",
        },
      ],
    });
  });

  // Distinct from "the registry has nothing to suggest" — that case returns
  // `{ ok: true, packages: [] }` via the empty-list branch below.
  it("reports failure distinctly when offline, never a silent empty list", async () => {
    const { fetchFn } = fetchStub("network-error");
    expect(
      await fetchSuggestions({ fetchFn, origin: ORIGIN, url: "https://example.com/" }),
    ).toEqual({
      ok: false,
    });
  });

  it("reports failure on a non-2xx response", async () => {
    const { fetchFn } = fetchStub(503);
    expect(
      await fetchSuggestions({ fetchFn, origin: ORIGIN, url: "https://example.com/" }),
    ).toEqual({
      ok: false,
    });
  });

  it("reports failure on a schema mismatch", async () => {
    const { fetchFn } = fetchStub({ nonsense: true });
    expect(
      await fetchSuggestions({ fetchFn, origin: ORIGIN, url: "https://example.com/" }),
    ).toEqual({
      ok: false,
    });
  });

  it("succeeds with an empty array when the registry genuinely has nothing", async () => {
    const { fetchFn } = fetchStub({ packages: [] });
    expect(
      await fetchSuggestions({ fetchFn, origin: ORIGIN, url: "https://example.com/" }),
    ).toEqual({
      ok: true,
      packages: [],
    });
  });

  it("does not fetch suggestions for an unsupported or missing tab URL", async () => {
    const { fetchFn, calls } = fetchStub({ packages: [] });

    expect(await fetchSuggestions({ fetchFn, origin: ORIGIN, url: "chrome://extensions" })).toEqual(
      {
        ok: true,
        packages: [],
      },
    );
    expect(await fetchSuggestions({ fetchFn, origin: ORIGIN, url: undefined })).toEqual({
      ok: true,
      packages: [],
    });
    expect(calls).toEqual([]);
  });
});
