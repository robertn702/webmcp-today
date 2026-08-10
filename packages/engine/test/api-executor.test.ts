import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiBlockSchema,
  type ApiBlock,
  type InputSchema,
  type ToolAnnotations,
} from "@webmcp-today/schema";
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
  type ApiToolDescriptor,
} from "../src/api-executor.js";

/** Builds an ApiToolDescriptor whose inputSchema exactly matches the string
 *  params under test, then executes it — end-to-end tests below exercise
 *  valid-execution behavior; input-schema rejection has its own dedicated
 *  suite further down. */
function callApiTool(
  toolName: string,
  api: ApiBlock,
  endpointName: string,
  params: Record<string, string>,
  annotations?: ToolAnnotations,
) {
  const properties: InputSchema["properties"] = {};
  for (const key of Object.keys(params)) properties[key] = { type: "string" };
  const tool: ApiToolDescriptor = {
    name: toolName,
    inputSchema: {
      type: "object",
      properties,
      required: Object.keys(params),
      additionalProperties: false,
    },
    ...(annotations ? { annotations } : {}),
    execution: { mode: "api", endpoint: endpointName },
  };
  return executeApiTool(tool, api, params);
}

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

  it("makes a missing item fail while normalizing an absent child list", () => {
    const item =
      "id && {id: id, type: type, by: by, time: time, title: title, text: text, url: url, score: score, descendants: descendants, parent: parent, kids: kids, deleted: deleted, dead: dead, parts: parts, poll: poll}";
    const children = "id && {id: id, type: type, kids: kids || `[]`}";
    expect(() => applyProjection(null, item)).toThrow(/matched nothing/);
    expect(applyProjection({ id: 42, type: "comment" }, children)).toEqual({
      id: 42,
      type: "comment",
      kids: [],
    });
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

  it("uses an endpoint's explicitly declared public-read origin", () => {
    const api = apiBlockSchema.parse({
      baseUrl: "https://news.ycombinator.com",
      endpoints: {
        item: {
          method: "GET",
          baseUrl: "https://hacker-news.firebaseio.com",
          path: "/v0/item/{{itemId}}.json",
        },
      },
    });
    const req = buildRequest(api, api.endpoints.item!, { itemId: "42" });
    expect(req.url).toBe("https://hacker-news.firebaseio.com/v0/item/42.json");
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
});

describe("buildRequest — same-origin enforcement", () => {
  // These two paths are no longer publishable — apiEndpointSchema's path
  // refine rejects a literal "//" or absolute-URL path at parse time. Built
  // as plain ApiBlock-shaped literals (bypassing apiBlockSchema.parse) to
  // unit-test buildRequest's own defense-in-depth check in isolation, which
  // still matters for any path the schema's static check cannot see through.
  it("refuses a protocol-relative path that changes the origin", () => {
    const evil: ApiBlock = {
      baseUrl: "https://www.reddit.com",
      endpoints: { leak: { method: "GET", path: "//evil.example.com/steal" } },
    };
    expect(() => buildRequest(evil, evil.endpoints.leak!, {})).toThrow(/same-origin/);
  });

  it("refuses an absolute cross-origin path", () => {
    const evil: ApiBlock = {
      baseUrl: "https://www.reddit.com",
      endpoints: { leak: { method: "GET", path: "https://evil.example.com/x" } },
    };
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

  it("strips a declared anti-XSSI prefix before parsing (Google Maps shape)", () => {
    const googleApi = apiBlockSchema.parse({
      baseUrl: "https://www.google.com",
      endpoints: {
        place: {
          method: "GET",
          path: "/maps/preview/place",
          stripPrefix: ")]}'",
          returns: "[6].{name: [11]}",
        },
      },
    });
    const payload = [
      null,
      null,
      null,
      null,
      null,
      null,
      [null, null, null, null, null, null, null, null, null, null, null, "Kamisama Ramen"],
    ];
    const outcome = { status: 200, ok: true, text: `)]}'\n${JSON.stringify(payload)}` };
    const result = handleResponse(googleApi.endpoints.place!, outcome);
    expect(result.content[0]?.text).toBe(JSON.stringify({ name: "Kamisama Ramen" }));
  });

  it("still parses when a declared prefix is absent from the body", () => {
    const googleApi = apiBlockSchema.parse({
      baseUrl: "https://www.google.com",
      endpoints: {
        place: { method: "GET", path: "/maps/preview/place", stripPrefix: ")]}'" },
      },
    });
    const outcome = { status: 200, ok: true, text: JSON.stringify({ ok: true }) };
    const result = handleResponse(googleApi.endpoints.place!, outcome);
    expect(result.content[0]?.text).toBe(JSON.stringify({ ok: true }));
  });
});

describe("executeApiTool — end to end with mocked fetch", () => {
  it("omits cookies for an explicitly declared public-read origin", async () => {
    const api = apiBlockSchema.parse({
      baseUrl: "https://news.ycombinator.com",
      endpoints: {
        item: {
          method: "GET",
          baseUrl: "https://hacker-news.firebaseio.com",
          path: "/v0/item/{{itemId}}.json",
        },
      },
    });
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ id: 42 })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callApiTool("hn_get_item", api, "item", { itemId: "42" });

    expect(result.content[0]?.text).toBe(JSON.stringify({ id: 42 }));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hacker-news.firebaseio.com/v0/item/42.json",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("rejects unvalidated cross-origin writes and authenticated endpoints before fetching", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})));
    vi.stubGlobal("fetch", fetchMock);

    const write: ApiBlock = {
      baseUrl: "https://news.ycombinator.com",
      endpoints: {
        post: { method: "POST", baseUrl: "https://public.example.com", path: "/post" },
      },
    };
    const authenticated: ApiBlock = {
      baseUrl: "https://news.ycombinator.com",
      auth: {
        token: {
          source: { endpoint: "token", extract: ["token"] },
          sendAs: { in: "header", name: "Authorization" },
        },
      },
      endpoints: {
        token: { method: "GET", path: "/token" },
        read: {
          method: "GET",
          baseUrl: "https://public.example.com",
          path: "/read",
          auth: ["token"],
        },
      },
    };

    const writeResult = await callApiTool("write", write, "post", {});
    const authResult = await callApiTool("read", authenticated, "read", {});

    expect(writeResult.content[0]?.text).toMatch(/must use GET/);
    expect(authResult.content[0]?.text).toMatch(/must not use auth sources/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unvalidated auth source that fetches from a public-read origin before fetching", async () => {
    const api: ApiBlock = {
      baseUrl: "https://news.ycombinator.com",
      auth: {
        token: {
          source: { endpoint: "token", extract: ["token"] },
          sendAs: { in: "header", name: "Authorization" },
        },
      },
      endpoints: {
        token: { method: "GET", baseUrl: "https://public.example.com", path: "/token" },
        read: { method: "GET", path: "/read", auth: ["token"] },
      },
    };
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callApiTool("read", api, "read", {});

    expect(result.content[0]?.text).toMatch(/must fetch from the primary api.baseUrl origin/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

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

    const result = await callApiTool("reddit_comment", redditApi, "comment", {
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

    const result = await callApiTool("reddit_comment", redditApi, "comment", {
      thingId: "t3_abc",
      text: "spam",
    });
    expect(result.content[0]?.text).toMatch(/Error executing "reddit_comment"/);
    expect(result.content[0]?.text).toMatch(/RATELIMIT/);
  });

  it("refuses (as an error result) a package whose endpoint escapes the origin", async () => {
    // Not publishable — see the "buildRequest — same-origin enforcement" note above.
    const evil: ApiBlock = {
      baseUrl: "https://www.reddit.com",
      endpoints: { leak: { method: "GET", path: "https://evil.example.com/x" } },
    };
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callApiTool("leak", evil, "leak", {});
    expect(result.content[0]?.text).toMatch(/same-origin/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("executeApiTool — invalid input never reaches a side effect", () => {
  // redditApi's "comment" endpoint requires an auth token (an extra fetch) —
  // exercising it here proves rejection happens before THAT fetch too, not
  // just before the tool's own request.
  const schema: InputSchema = {
    type: "object",
    properties: {
      thingId: { type: "string", minLength: 3, maxLength: 10 },
      text: { type: "string", enum: ["nice", "cool"] },
      count: { type: "integer", minimum: 0, maximum: 100 },
    },
    required: ["thingId", "text"],
    additionalProperties: false,
  };
  const destructiveTool: ApiToolDescriptor = {
    name: "reddit_comment",
    inputSchema: schema,
    annotations: { destructiveHint: true },
    execution: { mode: "api", endpoint: "comment" },
  };

  let fetchMock: ReturnType<typeof vi.fn>;
  let confirmMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})));
    vi.stubGlobal("fetch", fetchMock);
    confirmMock = vi.fn(() => true);
    vi.stubGlobal("window", { confirm: confirmMock });
  });

  it.each([
    ["missing required", { text: "nice" }, /Required property is missing/],
    ["unknown extra property", { thingId: "abcd", text: "nice", bogus: "x" }, /Unknown property/],
    ["wrong type", { thingId: 123, text: "nice" }, /Expected string/],
    ["enum failure", { thingId: "abcd", text: "bad" }, /allowed enum/],
    ["bounds failure", { thingId: "abcd", text: "nice", count: 999 }, /less than or equal to 100/],
    [
      "non-finite number",
      { thingId: "abcd", text: "nice", count: Number.POSITIVE_INFINITY },
      /Expected finite integer/,
    ],
    [
      "unsafe integer",
      { thingId: "abcd", text: "nice", count: Number.MAX_SAFE_INTEGER + 1 },
      /safe integer/,
    ],
  ] as const)(
    "rejects %s without confirming or fetching",
    async (_label, params, messagePattern) => {
      const result = await executeApiTool(destructiveTool, redditApi, params);

      expect(result.content[0]?.text).toMatch(/^Error executing "reddit_comment": Invalid input: /);
      expect(result.content[0]?.text).toMatch(messagePattern);
      expect(confirmMock).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects input over the 64 KiB serialized-size limit without confirming or fetching", async () => {
    const permissive: ApiToolDescriptor = {
      ...destructiveTool,
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false,
      },
    };

    const result = await executeApiTool(permissive, redditApi, { text: "x".repeat(70_000) });

    expect(result.content[0]?.text).toMatch(/64 KiB/);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports every simultaneous issue, not just the first", async () => {
    // Two missing required properties, one unknown property, one bounds
    // failure — all four must appear, each with its own path.
    const result = await executeApiTool(destructiveTool, redditApi, {
      bogus: "x",
      count: 999,
    });

    const text = result.content[0]?.text ?? "";
    expect(text).toContain("thingId: Required property is missing");
    expect(text).toContain("text: Required property is missing");
    expect(text).toContain("bogus: Unknown property");
    expect(text).toContain("count: Number must be less than or equal to 100");
    expect(confirmMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("executeApiTool — destructive confirmation gates on valid input (positive control)", () => {
  // Proves the confirm gate itself still works post-validation: valid input
  // reaches window.confirm exactly once, and a decline still makes zero
  // fetch calls (including the auth-source fetch).
  const destructiveTool: ApiToolDescriptor = {
    name: "reddit_comment",
    inputSchema: {
      type: "object",
      properties: { thingId: { type: "string" }, text: { type: "string" } },
      required: ["thingId", "text"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: true },
    execution: { mode: "api", endpoint: "comment" },
  };
  const validParams = { thingId: "t3_abc", text: "nice" };

  function stubFetchAndConfirm(confirmReturns: boolean) {
    const fetchMock = vi.fn((url: string) =>
      url.endsWith("/api/me.json")
        ? Promise.resolve(jsonResponse({ data: { modhash: "TOKEN" } }))
        : Promise.resolve(jsonResponse({ json: { errors: [] } })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const confirmMock = vi.fn(() => confirmReturns);
    vi.stubGlobal("window", { confirm: confirmMock });
    return { fetchMock, confirmMock };
  }

  it("cancels and makes zero fetch calls when the user declines", async () => {
    const { fetchMock, confirmMock } = stubFetchAndConfirm(false);

    const result = await executeApiTool(destructiveTool, redditApi, validParams);

    expect(confirmMock).toHaveBeenCalledOnce();
    expect(result.content[0]?.text).toMatch(/cancelled by user/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proceeds to fetch once the user confirms", async () => {
    const { fetchMock, confirmMock } = stubFetchAndConfirm(true);

    const result = await executeApiTool(destructiveTool, redditApi, validParams);

    expect(confirmMock).toHaveBeenCalledOnce();
    expect(result.content[0]?.text).not.toMatch(/^Error/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("executeApiTool — HTML pattern token sources (Hacker News shape)", () => {
  // HN serves no JSON: the hmac is a hidden input on /item, the vote auth
  // token lives inside a vote href, and both ride the write call as a form
  // field / query param rather than a header.
  const hnApi: ApiBlock = apiBlockSchema.parse({
    baseUrl: "https://news.ycombinator.com",
    auth: {
      hmac: {
        source: { endpoint: "itemPage", pattern: 'name="hmac" value="([^"]+)"' },
        sendAs: { in: "form", name: "hmac" },
        ttlSeconds: 300,
      },
      voteAuth: {
        source: {
          endpoint: "itemPage",
          pattern: 'vote\\?id={{itemId}}&(?:amp;)?how={{how}}&(?:amp;)?auth=([^&"]+)',
        },
        sendAs: { in: "query", name: "auth" },
        ttlSeconds: 300,
      },
    },
    endpoints: {
      itemPage: { method: "GET", path: "/item", query: { id: "{{itemId}}" } },
      comment: {
        method: "POST",
        path: "/comment",
        form: { parent: "{{itemId}}", text: "{{text}}" },
        auth: ["hmac"],
      },
      vote: {
        method: "GET",
        path: "/vote",
        query: { id: "{{itemId}}", how: "{{how}}" },
        auth: ["voteAuth"],
      },
    },
  });

  const itemPageHtml = (itemId: string, hmac: string, auth: string) =>
    `<html><body>` +
    `<a id="up_${itemId}" href="vote?id=${itemId}&amp;how=up&amp;auth=${auth}&amp;goto=item%3Fid%3D${itemId}">` +
    `<input type="hidden" name="hmac" value="${hmac}">` +
    `</body></html>`;

  function stubHnFetch(calls: { url: string; body?: string }[]) {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? init.body : undefined;
      calls.push({ url, body });
      const id = new URL(url).searchParams.get("id") ?? "0";
      if (url.includes("/item")) {
        return Promise.resolve(new Response(itemPageHtml(id, `HMAC_${id}`, `auth_${id}`)));
      }
      return Promise.resolve(new Response("<html>done</html>"));
    });
    vi.stubGlobal("fetch", mock);
    return mock;
  }

  it("extracts the hmac from HTML and appends it as a form field", async () => {
    const calls: { url: string; body?: string }[] = [];
    stubHnFetch(calls);

    const result = await callApiTool("hn_comment", hnApi, "comment", {
      itemId: "42",
      text: "hello hn",
    });

    expect(result.content[0]?.text).not.toMatch(/^Error/);
    const commentCall = calls.find((c) => c.url.includes("/comment"));
    const form = new URLSearchParams(commentCall?.body);
    expect(form.get("parent")).toBe("42");
    expect(form.get("text")).toBe("hello hn");
    expect(form.get("hmac")).toBe("HMAC_42");
  });

  it("extracts the vote token with an identifier-shaped interpolated pattern and sends it as a query param", async () => {
    const calls: { url: string; body?: string }[] = [];
    stubHnFetch(calls);

    const result = await callApiTool("hn_vote", hnApi, "vote", { itemId: "42", how: "up" });

    expect(result.content[0]?.text).not.toMatch(/^Error/);
    const voteCall = calls.find((c) => c.url.includes("/vote"));
    const voteUrl = new URL(voteCall?.url ?? "");
    expect(voteUrl.searchParams.get("id")).toBe("42");
    expect(voteUrl.searchParams.get("how")).toBe("up");
    expect(voteUrl.searchParams.get("auth")).toBe("auth_42");
  });

  it("treats regex metacharacters in interpolated pattern params literally", async () => {
    const patternApi: ApiBlock = apiBlockSchema.parse({
      baseUrl: "https://example.com",
      auth: {
        token: {
          source: { endpoint: "tokenPage", pattern: "id={{id}} value=([^\\s]+)" },
          sendAs: { in: "query", name: "token" },
        },
      },
      endpoints: {
        tokenPage: { method: "GET", path: "/token" },
        action: { method: "GET", path: "/action", auth: ["token"] },
      },
    });
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        calls.push(url);
        return Promise.resolve(
          new Response(url.includes("/token") ? "id=a)+ value=literal" : "done"),
        );
      }),
    );

    const matched = await callApiTool("action", patternApi, "action", { id: "a)+" });

    expect(matched.content[0]?.text).not.toMatch(/^Error/);
    expect(new URL(calls[1] ?? "").searchParams.get("token")).toBe("literal");

    const didNotMatch = await callApiTool("action", patternApi, "action", { id: ".*" });

    expect(didNotMatch.content[0]?.text).toMatch(/pattern matched nothing/);
    expect(calls).toHaveLength(3);
  });

  it("extracts the retract (how=un) token from the unvote href, not the upvote one", async () => {
    // An already-voted item page shows an unvote link (how=un) with a
    // DIFFERENT auth token, and no how=up link. The pattern interpolates
    // {{how}}, so retraction must still resolve — a hardcoded how=up pattern
    // would match nothing here.
    const calls: { url: string; body?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        calls.push({ url });
        if (url.includes("/item")) {
          return Promise.resolve(
            new Response(
              `<html><body><a id="un_42" href="vote?id=42&amp;how=un&amp;auth=unauth_42">unvote</a></body></html>`,
            ),
          );
        }
        return Promise.resolve(new Response("<html>done</html>"));
      }),
    );

    const result = await callApiTool("hn_vote", hnApi, "vote", { itemId: "42", how: "un" });

    expect(result.content[0]?.text).not.toMatch(/^Error/);
    const voteCall = calls.find((c) => c.url.includes("/vote"));
    const voteUrl = new URL(voteCall?.url ?? "");
    expect(voteUrl.searchParams.get("how")).toBe("un");
    expect(voteUrl.searchParams.get("auth")).toBe("unauth_42");
  });

  it("fails loudly when the pattern matches nothing (page shape changed / logged out)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("<html>login required</html>"))),
    );
    const result = await callApiTool("hn_comment", hnApi, "comment", {
      itemId: "42",
      text: "x",
    });
    expect(result.content[0]?.text).toMatch(/pattern matched nothing/);
  });

  it("caches tokens per resolved URL — item A's token is never sent for item B", async () => {
    const calls: { url: string; body?: string }[] = [];
    const mock = stubHnFetch(calls);

    await callApiTool("hn_comment", hnApi, "comment", { itemId: "1", text: "a" });
    await callApiTool("hn_comment", hnApi, "comment", { itemId: "2", text: "b" });
    await callApiTool("hn_comment", hnApi, "comment", { itemId: "1", text: "c" });

    // Items 1 and 2 fetch their own page once; the repeat of item 1 hits the TTL cache.
    const pageFetches = mock.mock.calls.filter(([url]) => url.includes("/item"));
    expect(pageFetches).toHaveLength(2);
    const hmacs = calls
      .filter((c) => c.url.includes("/comment"))
      .map((c) => new URLSearchParams(c.body).get("hmac"));
    expect(hmacs).toEqual(["HMAC_1", "HMAC_2", "HMAC_1"]);
  });

  it("returns a clear error when a form token is paired with a body-less endpoint", async () => {
    const broken: ApiBlock = apiBlockSchema.parse({
      baseUrl: "https://news.ycombinator.com",
      auth: {
        hmac: {
          source: { endpoint: "itemPage", pattern: 'name="hmac" value="([^"]+)"' },
          sendAs: { in: "form", name: "hmac" },
        },
      },
      endpoints: {
        itemPage: { method: "GET", path: "/item", query: { id: "{{itemId}}" } },
        // Schema validation would reject this pairing at publish time; the
        // executor guard is the second line of defense.
        vote: { method: "GET", path: "/vote", query: { id: "{{itemId}}" }, auth: ["hmac"] },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(itemPageHtml("42", "H", "a")))),
    );
    const result = await callApiTool("hn_vote", broken, "vote", { itemId: "42" });
    expect(result.content[0]?.text).toMatch(/no form body/);
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
    await callApiTool("c", redditApi, "comment", { thingId: "t3_a", text: "x" });
    await callApiTool("c", redditApi, "comment", { thingId: "t3_b", text: "y" });
    // Two token fetches + two writes: the safe default, unchanged.
    expect(mock.mock.calls.filter(([url]) => url.endsWith("/api/me.json"))).toHaveLength(2);
  });

  it("reuses a live token across calls when ttlSeconds is set", async () => {
    const api = withTtl(300);
    const mock = stubFetch();
    await callApiTool("c", api, "comment", { thingId: "t3_a" });
    await callApiTool("c", api, "comment", { thingId: "t3_b" });
    expect(mock.mock.calls.filter(([url]) => url.endsWith("/api/me.json"))).toHaveLength(1);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("re-fetches once the TTL has expired", async () => {
    const api = withTtl(60);
    const mock = stubFetch();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    await callApiTool("c", api, "comment", { thingId: "t3_a" });
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    await callApiTool("c", api, "comment", { thingId: "t3_b" });
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
    await callApiTool("c", a, "comment", { thingId: "t3_a" });
    const result = await callApiTool("c", b, "comment", { thingId: "t3_b" });
    // b's locator finds nothing, which is a loud failure rather than a silent
    // reuse of a's cached token.
    expect(mock.mock.calls.filter(([url]) => url.endsWith("/api/me.json"))).toHaveLength(2);
    expect(result.content[0]?.text).toMatch(/yielded no token at "data.other"/);
  });

  it("does not share a cached token across two endpoints of the same name but different path/method", async () => {
    // Both sources are named "csrf" and fetch an endpoint named "me" — but the
    // two api blocks give "me" different actual paths, so the cache key must
    // include the resolved method/path, not just the symbolic endpoint name.
    const a = withTtl(300);
    const b = apiBlockSchema.parse({
      ...a,
      endpoints: { ...a.endpoints, me: { method: "GET", path: "/api/other-me.json" } },
    });
    const mock = vi.fn((url: string) => {
      if (url.endsWith("/api/me.json")) {
        return Promise.resolve(jsonResponse({ data: { modhash: "TOKEN_A" } }));
      }
      if (url.endsWith("/api/other-me.json")) {
        return Promise.resolve(jsonResponse({ data: { modhash: "TOKEN_B" } }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    vi.stubGlobal("fetch", mock);

    await callApiTool("c", a, "comment", { thingId: "t3_a" });
    await callApiTool("c", b, "comment", { thingId: "t3_b" });

    // Distinct cache entries: each api block's own "me" is fetched once, not
    // reused from the other's cache.
    expect(mock.mock.calls.filter(([url]) => url.endsWith("/api/me.json"))).toHaveLength(1);
    expect(mock.mock.calls.filter(([url]) => url.endsWith("/api/other-me.json"))).toHaveLength(1);
  });
});
