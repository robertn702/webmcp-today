import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBlockSchema, type ApiBlock } from "@robertn702/webmcp-cafe-schema";
import {
  applyProjection,
  buildRequest,
  clearAuthTokenCache,
  executeApiTool,
  getByPath,
  handleResponse,
  interpolateDeep,
  isNonEmpty,
  resolveDocument,
} from "../src/lib/api-executor.js";

// A Reddit-shaped api block exercising REST read/write, an auth token source,
// query/path/form templates, a projection, and a GraphQL endpoint.
const redditApi: ApiBlock = apiBlockSchema.parse({
  baseUrl: "https://www.reddit.com",
  auth: {
    csrf: {
      source: { endpoint: "me", extract: ["data", "modhash"] },
      sendAs: { in: "header", name: "X-Modhash" },
    },
  },
  endpoints: {
    me: { method: "GET", path: "/api/me.json" },
    subredditHot: {
      method: "GET",
      path: "/r/{{subreddit}}/hot.json",
      query: { limit: "{{limit}}" },
      returns: "data.children[].data.title",
    },
    comment: {
      method: "POST",
      path: "/api/comment",
      form: { thing_id: "{{thingId}}", text: "{{text}}", api_type: "json" },
      auth: ["csrf"],
      errorPath: ["json", "errors"],
    },
    search: {
      method: "POST",
      path: "/svc/shreddit/graphql",
      graphql: { document: "@documents/search", variables: { query: "{{query}}", first: 10 } },
      errorPath: ["errors"],
    },
    // Typed substitution: `first` is a whole-string placeholder, so it must
    // reach the wire as a number, not "25".
    searchTyped: {
      method: "POST",
      path: "/svc/shreddit/graphql",
      graphql: {
        document: "@documents/search",
        variables: { query: "{{query}}", first: "{{first}}", label: "top {{first}}" },
      },
    },
    searchPersisted: {
      method: "POST",
      path: "/svc/shreddit/graphql",
      graphql: { document: "@documents/search", variables: {} },
      persistedQuery: true,
    },
  },
  documents: {
    search: "query Search($query: String!, $first: Int) { search { title } }",
  },
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // The TTL cache outlives a tool call by design, so it outlives a test too.
  clearAuthTokenCache();
});

describe("getByPath", () => {
  it("walks object keys and array indices", () => {
    const value = { data: { children: [{ data: { title: "hi" } }] } };
    expect(getByPath(value, ["data", "children", "0", "data", "title"])).toBe("hi");
    expect(getByPath(value, ["data", "modhash"])).toBeUndefined();
    expect(getByPath(null, ["a", "b"])).toBeUndefined();
  });

  it("reads a key containing a dot, which a dot-string locator could not", () => {
    expect(getByPath({ "a.b": { c: 1 } }, ["a.b", "c"])).toBe(1);
  });
});

describe("isNonEmpty", () => {
  it("treats empty collections/strings/nullish as empty, populated ones as present", () => {
    expect(isNonEmpty([])).toBe(false);
    expect(isNonEmpty("")).toBe(false);
    expect(isNonEmpty({})).toBe(false);
    expect(isNonEmpty(null)).toBe(false);
    expect(isNonEmpty(undefined)).toBe(false);
    expect(isNonEmpty(["e"])).toBe(true);
    expect(isNonEmpty("x")).toBe(true);
    expect(isNonEmpty({ a: 1 })).toBe(true);
    expect(isNonEmpty(0)).toBe(true);
    expect(isNonEmpty(false)).toBe(true);
  });
});

describe("interpolateDeep", () => {
  it("interpolates {{param}} on string leaves only", () => {
    const out = interpolateDeep(
      { q: "{{query}}", first: 10, nested: ["{{query}}", 2] },
      { query: "cats" },
    );
    expect(out).toEqual({ q: "cats", first: 10, nested: ["cats", 2] });
  });

  it("emits the raw typed value when the whole string is one placeholder", () => {
    expect(interpolateDeep({ n: "{{n}}" }, { n: 10 })).toEqual({ n: 10 });
    expect(interpolateDeep({ ok: "{{ok}}" }, { ok: false })).toEqual({ ok: false });
    expect(interpolateDeep({ tags: "{{tags}}" }, { tags: ["a"] })).toEqual({ tags: ["a"] });
  });

  it("still concatenates when the placeholder is only part of the string", () => {
    expect(interpolateDeep({ n: "page {{n}}" }, { n: 10 })).toEqual({ n: "page 10" });
  });

  it("yields undefined for a whole-string placeholder with no value, so JSON drops it", () => {
    expect(interpolateDeep("{{missing}}", {})).toBeUndefined();
    expect(JSON.stringify(interpolateDeep({ a: "{{missing}}", b: 1 }, {}))).toBe('{"b":1}');
  });

  it("still substitutes an empty string mid-template", () => {
    expect(interpolateDeep("x{{missing}}y", {})).toBe("xy");
  });
});

describe("applyProjection", () => {
  const response = {
    data: {
      children: [{ data: { title: "a", score: 10 } }, { data: { title: "b", score: 60 } }],
    },
  };

  it("selects a subtree via a path", () => {
    expect(applyProjection(response, "data.children")).toEqual(response.data.children);
  });

  it("flattens and maps over an array", () => {
    expect(applyProjection(response, "data.children[].data.title")).toEqual(["a", "b"]);
  });

  it("returns the whole value when returns is undefined", () => {
    expect(applyProjection(response, undefined)).toBe(response);
  });

  it("picks fields with a multi-select hash", () => {
    expect(applyProjection(response, "data.children[].data.{title: title}")).toEqual([
      { title: "a" },
      { title: "b" },
    ]);
  });

  it("picks fields directly off an object", () => {
    expect(
      applyProjection(
        { data: { name: "x", karma: 5, junk: 1 } },
        "data.{name: name, karma: karma}",
      ),
    ).toEqual({ name: "x", karma: 5 });
  });

  it("filters — expressible only because the grammar is JMESPath now", () => {
    expect(applyProjection(response, "data.children[?data.score > `50`].data.title")).toEqual([
      "b",
    ]);
  });

  it("THROWS when the projection matches nothing (API rot fails loudly)", () => {
    // The old grammar silently returned the whole response here, hiding the
    // shape change that caused it.
    expect(() => applyProjection(response, "data.missing.title")).toThrow(/matched nothing/);
  });

  it("THROWS on a malformed expression rather than falling back", () => {
    expect(() => applyProjection(response, "data.{unterminated")).toThrow();
  });

  it("passes an empty array through — no results is not an error", () => {
    expect(applyProjection({ data: { children: [] } }, "data.children[].data.title")).toEqual([]);
  });
});

describe("resolveDocument", () => {
  it("resolves @documents/ references and passes inline documents through", () => {
    expect(resolveDocument(redditApi, "@documents/search")).toContain("query Search");
    expect(resolveDocument(redditApi, "query Inline { a }")).toBe("query Inline { a }");
  });

  it("throws on an undefined document reference", () => {
    expect(() => resolveDocument(redditApi, "@documents/nope")).toThrow(/not defined/);
  });
});

describe("buildRequest — construction + interpolation", () => {
  it("builds a GET with path + query interpolation", () => {
    const req = buildRequest(redditApi, redditApi.endpoints.subredditHot!, {
      subreddit: "aww",
      limit: 5,
    });
    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://www.reddit.com/r/aww/hot.json?limit=5");
    expect(req.body).toBeUndefined();
  });

  it("percent-encodes path params so they cannot inject path/query/CRLF", () => {
    const req = buildRequest(redditApi, redditApi.endpoints.subredditHot!, {
      subreddit: "a/b?c d\r\n",
      limit: 1,
    });
    expect(req.url).toBe("https://www.reddit.com/r/a%2Fb%3Fc%20d%0D%0A/hot.json?limit=1");
    expect(new URL(req.url).origin).toBe("https://www.reddit.com");
  });

  it("builds a urlencoded form body", () => {
    const req = buildRequest(redditApi, redditApi.endpoints.comment!, {
      thingId: "t3_abc",
      text: "hello world & friends",
    });
    expect(req.method).toBe("POST");
    expect(req.headers["content-type"]).toBe("application/x-www-form-urlencoded;charset=UTF-8");
    const parsed = new URLSearchParams(req.body);
    expect(parsed.get("thing_id")).toBe("t3_abc");
    expect(parsed.get("text")).toBe("hello world & friends");
    expect(parsed.get("api_type")).toBe("json");
  });

  it("builds a graphql POST with resolved document + interpolated variables", () => {
    const req = buildRequest(redditApi, redditApi.endpoints.search!, { query: "cats" });
    expect(req.headers["content-type"]).toBe("application/json");
    const body: unknown = JSON.parse(req.body ?? "");
    expect(getByPath(body, ["query"])).toContain("query Search");
    expect(getByPath(body, ["variables", "query"])).toBe("cats");
    expect(getByPath(body, ["variables", "first"])).toBe(10);
  });

  it("sends a whole-string placeholder as its raw type in a JSON body", () => {
    const req = buildRequest(redditApi, redditApi.endpoints.searchTyped!, {
      query: "cats",
      first: 25,
    });
    const body: unknown = JSON.parse(req.body ?? "");
    // The number stays a number; the same param inside a larger string does not.
    expect(getByPath(body, ["variables", "first"])).toBe(25);
    expect(getByPath(body, ["variables", "label"])).toBe("top 25");
  });

  it("throws 'not yet supported' for persistedQuery endpoints (APQ stub)", () => {
    expect(() =>
      buildRequest(redditApi, redditApi.endpoints.searchPersisted!, { query: "x" }),
    ).toThrow(/persistedQuery/);
  });
});

describe("buildRequest — same-origin enforcement", () => {
  it("refuses a protocol-relative path that changes the origin", () => {
    const evil: ApiBlock = apiBlockSchema.parse({
      baseUrl: "https://www.reddit.com",
      endpoints: { leak: { method: "GET", path: "//evil.example.com/steal" } },
    });
    expect(() => buildRequest(evil, evil.endpoints.leak!, {})).toThrow(/same-origin/);
  });

  it("refuses an absolute cross-origin path", () => {
    const evil: ApiBlock = apiBlockSchema.parse({
      baseUrl: "https://www.reddit.com",
      endpoints: { leak: { method: "GET", path: "https://evil.example.com/x" } },
    });
    expect(() => buildRequest(evil, evil.endpoints.leak!, {})).toThrow(/same-origin/);
  });
});

describe("handleResponse — errorPath + projection", () => {
  it("projects a successful REST response", () => {
    const outcome = {
      status: 200,
      ok: true,
      text: JSON.stringify({ data: { children: [{ data: { title: "a" } }] } }),
    };
    const result = handleResponse(redditApi.endpoints.subredditHot!, outcome);
    expect(result.content[0]?.text).toBe(JSON.stringify(["a"]));
  });

  it("treats a non-empty errorPath payload as failure", () => {
    const outcome = {
      status: 200,
      ok: true,
      text: JSON.stringify({ json: { errors: [["BAD_CAPTCHA", "nope"]] } }),
    };
    expect(() => handleResponse(redditApi.endpoints.comment!, outcome)).toThrow(/API error/);
  });

  it("passes when the errorPath payload is an empty array", () => {
    const outcome = { status: 200, ok: true, text: JSON.stringify({ json: { errors: [] } }) };
    expect(() => handleResponse(redditApi.endpoints.comment!, outcome)).not.toThrow();
  });

  it("defaults GraphQL errorPath to ['errors']", () => {
    const noExplicit = apiBlockSchema.parse({
      baseUrl: "https://www.reddit.com",
      endpoints: {
        gql: { method: "POST", path: "/gql", graphql: { document: "query { a }" } },
      },
    });
    const outcome = {
      status: 200,
      ok: true,
      text: JSON.stringify({ errors: [{ message: "boom" }] }),
    };
    expect(() => handleResponse(noExplicit.endpoints.gql!, outcome)).toThrow(/API error/);
  });

  it("surfaces an HTTP error status", () => {
    const outcome = { status: 500, ok: false, text: JSON.stringify({ error: "server" }) };
    expect(() => handleResponse(redditApi.endpoints.me!, outcome)).toThrow(/HTTP 500/);
  });
});

describe("executeApiTool — end to end with mocked fetch", () => {
  it("resolves an auth token then attaches it to the write request (one fetch per source)", async () => {
    const calls: { url: string; headers: Record<string, string>; body?: string }[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const headers: Record<string, string> = {};
      if (init?.headers && typeof init.headers === "object" && !Array.isArray(init.headers)) {
        for (const [k, v] of Object.entries(init.headers)) headers[k] = String(v);
      }
      const body = typeof init?.body === "string" ? init.body : undefined;
      calls.push({ url, headers, body });
      if (url.endsWith("/api/me.json")) {
        return Promise.resolve(jsonResponse({ data: { modhash: "TOKEN123" } }));
      }
      return Promise.resolve(jsonResponse({ json: { errors: [] } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeApiTool("reddit_comment", redditApi, "comment", {
      thingId: "t3_abc",
      text: "nice",
    });

    expect(result.content[0]?.text).not.toMatch(/^Error/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const meCall = calls.find((c) => c.url.endsWith("/api/me.json"));
    const commentCall = calls.find((c) => c.url.endsWith("/api/comment"));
    expect(meCall).toBeDefined();
    expect(commentCall?.headers["X-Modhash"]).toBe("TOKEN123");
    expect(new URLSearchParams(commentCall?.body).get("text")).toBe("nice");
  });

  it("returns an error result (does not throw) when the site reports an error payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("/api/me.json")
          ? Promise.resolve(jsonResponse({ data: { modhash: "T" } }))
          : Promise.resolve(jsonResponse({ json: { errors: [["RATELIMIT", "slow down"]] } })),
      ),
    );

    const result = await executeApiTool("reddit_comment", redditApi, "comment", {
      thingId: "t3_abc",
      text: "spam",
    });
    expect(result.content[0]?.text).toMatch(/Error executing "reddit_comment"/);
    expect(result.content[0]?.text).toMatch(/RATELIMIT/);
  });

  it("refuses (as an error result) a package whose endpoint escapes the origin", async () => {
    const evil = apiBlockSchema.parse({
      baseUrl: "https://www.reddit.com",
      endpoints: { leak: { method: "GET", path: "https://evil.example.com/x" } },
    });
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})));
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeApiTool("leak", evil, "leak", {});
    expect(result.content[0]?.text).toMatch(/same-origin/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("auth token TTL cache", () => {
  /** Same block, with a ttlSeconds on the csrf source. */
  const withTtl = (ttlSeconds: number): ApiBlock =>
    apiBlockSchema.parse({
      baseUrl: "https://www.reddit.com",
      auth: {
        csrf: {
          source: { endpoint: "me", extract: ["data", "modhash"] },
          sendAs: { in: "header", name: "X-Modhash" },
          ttlSeconds,
        },
      },
      endpoints: {
        me: { method: "GET", path: "/api/me.json" },
        comment: {
          method: "POST",
          path: "/api/comment",
          form: { thing_id: "{{thingId}}" },
          auth: ["csrf"],
        },
      },
    });

  function stubFetch() {
    const mock = vi.fn((url: string) =>
      url.endsWith("/api/me.json")
        ? Promise.resolve(jsonResponse({ data: { modhash: "TOKEN" } }))
        : Promise.resolve(jsonResponse({ ok: true })),
    );
    vi.stubGlobal("fetch", mock);
    return mock;
  }

  it("re-fetches the token on every call when ttlSeconds is omitted", async () => {
    const mock = stubFetch();
    await executeApiTool("c", redditApi, "comment", { thingId: "t3_a", text: "x" });
    await executeApiTool("c", redditApi, "comment", { thingId: "t3_b", text: "y" });
    // Two token fetches + two writes: the safe default, unchanged.
    expect(mock.mock.calls.filter(([url]) => url.endsWith("/api/me.json"))).toHaveLength(2);
  });

  it("reuses a live token across calls when ttlSeconds is set", async () => {
    const api = withTtl(300);
    const mock = stubFetch();
    await executeApiTool("c", api, "comment", { thingId: "t3_a" });
    await executeApiTool("c", api, "comment", { thingId: "t3_b" });
    expect(mock.mock.calls.filter(([url]) => url.endsWith("/api/me.json"))).toHaveLength(1);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("re-fetches once the TTL has expired", async () => {
    const api = withTtl(60);
    const mock = stubFetch();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    await executeApiTool("c", api, "comment", { thingId: "t3_a" });
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    await executeApiTool("c", api, "comment", { thingId: "t3_b" });
    expect(mock.mock.calls.filter(([url]) => url.endsWith("/api/me.json"))).toHaveLength(2);
  });

  it("does not hand one package's token to another on the same origin", async () => {
    // Same origin, same source name, different extract locator — the key must
    // separate them.
    const a = withTtl(300);
    const b = apiBlockSchema.parse({
      ...a,
      auth: {
        csrf: {
          source: { endpoint: "me", extract: ["data", "other"] },
          sendAs: { in: "header", name: "X-Modhash" },
          ttlSeconds: 300,
        },
      },
    });
    const mock = stubFetch();
    await executeApiTool("c", a, "comment", { thingId: "t3_a" });
    const result = await executeApiTool("c", b, "comment", { thingId: "t3_b" });
    // b's locator finds nothing, which is a loud failure rather than a silent
    // reuse of a's cached token.
    expect(mock.mock.calls.filter(([url]) => url.endsWith("/api/me.json"))).toHaveLength(2);
    expect(result.content[0]?.text).toMatch(/yielded no token at "data.other"/);
  });
});
