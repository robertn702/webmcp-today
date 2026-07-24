import { describe, expect, it } from "vitest";
import { createConfigSchema, publishVersionSchema } from "../src/index.js";

// A Reddit-style tier-1 config: REST read (subredditHot) + write (comment with
// the csrf modhash token source) + a GraphQL endpoint exercising errorPath,
// persistedQuery, and an @documents reference. Cloned + mutated per failure test.
const base = {
  domain: "reddit.com",
  urlPatterns: ["*://*.reddit.com/*"],
  title: "Reddit API tools",
  description: "Read and write Reddit via its JSON API.",
  api: {
    baseUrl: "https://www.reddit.com",
    auth: {
      csrf: {
        source: { endpoint: "me", extract: "data.modhash" },
        sendAs: { header: "X-Modhash" },
      },
    },
    endpoints: {
      me: { method: "GET", path: "/api/me.json" },
      subredditHot: {
        method: "GET",
        path: "/r/{{subreddit}}/hot.json",
        query: { limit: "{{limit}}" },
        returns: "data.children[].data.{title,author,score}",
      },
      comment: {
        method: "POST",
        path: "/api/comment",
        form: { thing_id: "{{thingId}}", text: "{{text}}", api_type: "json" },
        auth: ["csrf"],
        errorPath: "json.errors",
      },
      searchGraphql: {
        method: "POST",
        path: "/svc/shreddit/graphql",
        graphql: { document: "@documents/search", variables: { query: "{{query}}", first: 10 } },
        errorPath: "errors",
        persistedQuery: true,
        returns: "data.search",
      },
    },
    documents: {
      search: "query Search($query: String!, $first: Int) { search { docCount } }",
    },
  },
  tools: [
    {
      name: "reddit_subreddit_hot",
      description: "List hot posts in a subreddit.",
      inputSchema: {
        type: "object",
        properties: {
          subreddit: { type: "string", description: "Subreddit name" },
          limit: { type: "integer", description: "Max posts" },
        },
        required: ["subreddit"],
      },
      annotations: { readOnlyHint: true },
      execution: { mode: "api", endpoint: "subredditHot" },
    },
    {
      name: "reddit_comment",
      description: "Post a comment on a post or reply.",
      inputSchema: {
        type: "object",
        properties: {
          thingId: { type: "string", description: "Fullname, e.g. t3_abc" },
          text: { type: "string", description: "Comment body" },
        },
        required: ["thingId", "text"],
      },
      annotations: { readOnlyHint: false },
      execution: { mode: "api", endpoint: "comment" },
    },
    {
      name: "reddit_search",
      description: "Search Reddit.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Search query" } },
        required: ["query"],
      },
      execution: { mode: "api", endpoint: "searchGraphql" },
    },
  ],
};

describe("api block cross-validation", () => {
  it("accepts a valid Reddit-style REST + GraphQL config", () => {
    expect(createConfigSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an {{placeholder}} that names no inputSchema property", () => {
    const c = structuredClone(base);
    c.api.endpoints.subredditHot.query.limit = "{{limitz}}";
    expect(createConfigSchema.safeParse(c).success).toBe(false);
  });

  it("rejects a tool bound to an endpoint that does not exist", () => {
    const c = structuredClone(base);
    const tool = c.tools[0];
    if (!tool) throw new Error("fixture missing tool");
    tool.execution = { mode: "api", endpoint: "doesNotExist" };
    expect(createConfigSchema.safeParse(c).success).toBe(false);
  });

  it("rejects an endpoint auth ref that names no auth token source", () => {
    const c = structuredClone(base);
    c.api.endpoints.comment.auth = ["nope"];
    expect(createConfigSchema.safeParse(c).success).toBe(false);
  });

  it("rejects an @documents ref that names no defined document", () => {
    const c = structuredClone(base);
    c.api.endpoints.searchGraphql.graphql.document = "@documents/missing";
    expect(createConfigSchema.safeParse(c).success).toBe(false);
  });

  it("rejects a baseUrl whose host no urlPatterns host covers", () => {
    const c = structuredClone(base);
    c.api.baseUrl = "https://evil.example.com";
    expect(createConfigSchema.safeParse(c).success).toBe(false);
  });

  it("does not flag {{placeholders}} inside the opaque documents block", () => {
    const c = structuredClone(base);
    c.api.documents.search = "query { {{notAProp}} }";
    expect(createConfigSchema.safeParse(c).success).toBe(true);
  });

  it("does not scan an inline graphql.document string (opaque)", () => {
    const c = structuredClone(base);
    c.api.endpoints.searchGraphql.graphql.document = "query { {{notAProp}} }";
    expect(createConfigSchema.safeParse(c).success).toBe(true);
  });

  it("scans body templates (rejects unknown, accepts valid)", () => {
    const withBody = (body: Record<string, string>) => ({
      domain: "example.com",
      urlPatterns: ["*://example.com/*"],
      title: "x",
      description: "x",
      api: {
        baseUrl: "https://example.com",
        endpoints: { create: { method: "POST", path: "/api/create", body } },
      },
      tools: [
        {
          name: "create_thing",
          description: "Create a thing.",
          inputSchema: {
            type: "object",
            properties: { title: { type: "string", description: "Title" } },
            required: ["title"],
          },
          execution: { mode: "api", endpoint: "create" },
        },
      ],
    });
    expect(createConfigSchema.safeParse(withBody({ title: "{{bogus}}" })).success).toBe(false);
    expect(createConfigSchema.safeParse(withBody({ title: "{{title}}" })).success).toBe(true);
  });

  it("rejects a non-https baseUrl", () => {
    const c = structuredClone(base);
    c.api.baseUrl = "http://www.reddit.com";
    expect(createConfigSchema.safeParse(c).success).toBe(false);
  });

  it("rejects an auth source that fetches from an undefined endpoint", () => {
    const c = structuredClone(base);
    c.api.auth.csrf.source.endpoint = "ghost";
    expect(createConfigSchema.safeParse(c).success).toBe(false);
  });

  it("rejects a tool whose execution.mode is an unknown discriminator", () => {
    const result = createConfigSchema.safeParse({
      domain: "reddit.com",
      urlPatterns: ["*://*.reddit.com/*"],
      title: "x",
      description: "x",
      api: {
        baseUrl: "https://www.reddit.com",
        endpoints: { me: { method: "GET", path: "/api/me.json" } },
      },
      tools: [
        {
          name: "bogus",
          description: "Unknown execution mode.",
          inputSchema: { type: "object", properties: {}, required: [] },
          execution: { mode: "bogus" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("runs the same api cross-validation on publishVersionSchema", () => {
    const version = { urlPatterns: base.urlPatterns, tools: base.tools, api: base.api };
    expect(publishVersionSchema.safeParse(version).success).toBe(true);
    const broken = structuredClone(version);
    const tool = broken.tools[0];
    if (!tool) throw new Error("fixture missing tool");
    tool.execution = { mode: "api", endpoint: "ghost" };
    expect(publishVersionSchema.safeParse(broken).success).toBe(false);
  });
});
