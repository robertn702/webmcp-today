import { describe, expect, it } from "vitest";
import { DOMAINS_KEY, type DomainsDoc } from "../src/lib/store-schema.js";
import { isDomainAvailable, pollDomains, readDomainsDoc } from "../src/lib/domains.js";
import { createFakeStorageArea } from "./fake-storage-area.js";

const ORIGIN = "https://registry.test";

function doc(domains: string[]): DomainsDoc {
  return {
    version: 1,
    generatedAt: "2026-07-26T00:00:00.000Z",
    fetchedAt: "2026-07-26T00:00:00.000Z",
    domains,
  };
}

type FetchStub = { fetchFn: (url: string) => Promise<Response>; calls: string[] };

/** "network-error" rejects, a number is a bare HTTP status, anything else is a 200 JSON body. */
function fetchStub(response: unknown | "network-error" | number): FetchStub {
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

describe("isDomainAvailable", () => {
  it("matches the exact domain", () => {
    expect(isDomainAvailable(doc(["example.com"]), "example.com")).toBe(true);
  });

  it("matches a subdomain via suffix", () => {
    expect(isDomainAvailable(doc(["example.com"]), "www.example.com")).toBe(true);
    expect(isDomainAvailable(doc(["example.com"]), "old.example.com")).toBe(true);
  });

  it("does not match an unrelated domain that merely shares a suffix string", () => {
    expect(isDomainAvailable(doc(["example.com"]), "notexample.com")).toBe(false);
  });

  it("is false with no stored doc", () => {
    expect(isDomainAvailable(undefined, "example.com")).toBe(false);
  });

  it("is false with an empty domain list", () => {
    expect(isDomainAvailable(doc([]), "example.com")).toBe(false);
  });
});

describe("pollDomains", () => {
  it("fetches and stores the domain list", async () => {
    const area = createFakeStorageArea();
    const { fetchFn, calls } = fetchStub({
      version: 5,
      generatedAt: "2026-07-27T00:00:00.000Z",
      domains: ["example.com", "reddit.com"],
    });

    const result = await pollDomains({ area, fetchFn, origin: ORIGIN });

    expect(calls).toEqual([`${ORIGIN}/api/domains`]);
    expect(result).toMatchObject({ ok: true });
    const stored = await readDomainsDoc(area);
    expect(stored?.domains).toEqual(["example.com", "reddit.com"]);
  });

  it.each([
    ["network error", "network-error"],
    ["non-2xx", 503],
    ["schema mismatch", { nonsense: true }],
  ])("keeps the old list when the poll fails (%s)", async (_name, response) => {
    const before = doc(["example.com"]);
    const area = createFakeStorageArea({ [DOMAINS_KEY]: before });
    const { fetchFn } = fetchStub(response);

    const result = await pollDomains({ area, fetchFn, origin: ORIGIN });

    expect(result).toEqual({ ok: false });
    expect(await readDomainsDoc(area)).toEqual(before);
  });
});

describe("readDomainsDoc", () => {
  it("returns undefined when never polled", async () => {
    expect(await readDomainsDoc(createFakeStorageArea())).toBeUndefined();
  });

  it("treats a corrupt doc as absent", async () => {
    const area = createFakeStorageArea({ [DOMAINS_KEY]: { version: "what" } });
    expect(await readDomainsDoc(area)).toBeUndefined();
  });
});
