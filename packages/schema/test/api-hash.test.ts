import { describe, expect, it } from "vitest";
import { apiContentHash, canonicalizeApiBlock, type ApiBlock } from "../src/index.js";

// The canonical form is a frozen compatibility surface — clients key stored
// copies of an api surface on the hash, so a change here silently invalidates
// every copy already on disk. These tests pin the properties that make it safe
// to do that: order-independence for objects, order-dependence for arrays, and
// sensitivity to every value.

/** Reddit-shaped: nested auth, nested endpoints, an ordered auth array, and
 * graphql.variables carrying a number. Keys deliberately out of sorted order. */
const base: ApiBlock = {
  endpoints: {
    subredditHot: {
      path: "/r/{{subreddit}}/hot.json",
      method: "GET",
      returns: "data.children[].data.title",
    },
    comment: {
      method: "POST",
      path: "/api/comment",
      auth: ["csrf", "session"],
      form: { text: "{{text}}", thing_id: "{{thingId}}" },
    },
    search: {
      method: "POST",
      path: "/graphql",
      graphql: { variables: { first: 10, query: "{{query}}" }, document: "@documents/search" },
    },
  },
  baseUrl: "https://www.reddit.com",
  documents: { search: "query Search { search { docCount } }" },
  auth: {
    session: {
      sendAs: { in: "header", name: "X-Session" },
      source: { endpoint: "me", extract: ["data", "sid"] },
    },
    csrf: {
      source: { endpoint: "me", extract: ["data", "modhash"] },
      sendAs: { in: "header", name: "X-Modhash" },
    },
  },
};

/** Same logical block, every object literal written in a different key order
 * (and the two auth sources declared in the opposite order). */
const reordered: ApiBlock = {
  baseUrl: "https://www.reddit.com",
  auth: {
    csrf: {
      sendAs: { name: "X-Modhash", in: "header" },
      source: { extract: ["data", "modhash"], endpoint: "me" },
    },
    session: {
      source: { extract: ["data", "sid"], endpoint: "me" },
      sendAs: { name: "X-Session", in: "header" },
    },
  },
  documents: { search: "query Search { search { docCount } }" },
  endpoints: {
    comment: {
      form: { thing_id: "{{thingId}}", text: "{{text}}" },
      auth: ["csrf", "session"],
      path: "/api/comment",
      method: "POST",
    },
    search: {
      graphql: { document: "@documents/search", variables: { query: "{{query}}", first: 10 } },
      path: "/graphql",
      method: "POST",
    },
    subredditHot: {
      returns: "data.children[].data.title",
      method: "GET",
      path: "/r/{{subreddit}}/hot.json",
    },
  },
};

const minimal: ApiBlock = {
  baseUrl: "https://example.com",
  endpoints: { ping: { method: "GET", path: "/ping" } },
};

/** Structured-clone a block and hand the copy to `mutate`, so each test's edit
 * cannot leak into the shared fixtures. */
function variant(mutate: (draft: ApiBlock) => void): ApiBlock {
  const draft = structuredClone(base);
  mutate(draft);
  return draft;
}

describe("canonicalizeApiBlock", () => {
  it("is independent of key insertion order", () => {
    expect(canonicalizeApiBlock(reordered)).toBe(canonicalizeApiBlock(base));
  });

  it("sorts keys recursively, not just at the top level", () => {
    const canonical = canonicalizeApiBlock(base);
    // Top level.
    expect(canonical.indexOf('"auth"')).toBeLessThan(canonical.indexOf('"baseUrl"'));
    expect(canonical.indexOf('"baseUrl"')).toBeLessThan(canonical.indexOf('"documents"'));
    expect(canonical.indexOf('"documents"')).toBeLessThan(canonical.indexOf('"endpoints"'));
    // Nested: endpoints record keys, endpoint fields, auth source fields, and
    // graphql.variables all sorted too.
    expect(canonical).toContain('"comment":{"auth":["csrf","session"],"form":');
    expect(canonical).toContain('"csrf":{"sendAs":{"in":"header","name":"X-Modhash"},"source":');
    expect(canonical).toContain('"source":{"endpoint":"me","extract":["data","modhash"]}');
    expect(canonical).toContain('"graphql":{"document":"@documents/search"');
    expect(canonical).toContain('"variables":{"first":10,"query":"{{query}}"}');
  });

  it("preserves array order", () => {
    const canonical = canonicalizeApiBlock(base);
    expect(canonical).toContain('"auth":["csrf","session"]');

    const swapped = variant((draft) => {
      const comment = draft.endpoints.comment;
      if (!comment) throw new Error("fixture missing comment endpoint");
      comment.auth = ["session", "csrf"];
    });
    expect(canonicalizeApiBlock(swapped)).toContain('"auth":["session","csrf"]');
    expect(canonicalizeApiBlock(swapped)).not.toBe(canonical);
  });

  it("treats an explicitly-undefined optional field as absent", () => {
    const withUndefined: ApiBlock = { ...minimal, auth: undefined, documents: undefined };
    expect(canonicalizeApiBlock(withUndefined)).toBe(canonicalizeApiBlock(minimal));
  });

  it("uses a stable number representation", () => {
    const one = variant((draft) => {
      const search = draft.endpoints.search;
      if (!search?.graphql) throw new Error("fixture missing graphql endpoint");
      search.graphql.variables = { first: 1.0, query: "{{query}}" };
    });
    const intForm = variant((draft) => {
      const search = draft.endpoints.search;
      if (!search?.graphql) throw new Error("fixture missing graphql endpoint");
      search.graphql.variables = { first: 1, query: "{{query}}" };
    });
    expect(canonicalizeApiBlock(one)).toBe(canonicalizeApiBlock(intForm));
    expect(canonicalizeApiBlock(one)).toContain('"first":1,');

    const zero = variant((draft) => {
      const search = draft.endpoints.search;
      if (!search?.graphql) throw new Error("fixture missing graphql endpoint");
      search.graphql.variables = { first: -0 };
    });
    expect(canonicalizeApiBlock(zero)).toContain('"first":0');
  });

  it("refuses non-finite numbers rather than folding them to null", () => {
    const notANumber = variant((draft) => {
      const search = draft.endpoints.search;
      if (!search?.graphql) throw new Error("fixture missing graphql endpoint");
      search.graphql.variables = { first: Number.NaN };
    });
    expect(() => canonicalizeApiBlock(notANumber)).toThrow(/NaN is not allowed/);
  });

  it("produces the exact pinned canonical string", () => {
    expect(canonicalizeApiBlock(minimal)).toBe(
      '{"baseUrl":"https://example.com","endpoints":{"ping":{"method":"GET","path":"/ping"}}}',
    );
  });
});

describe("apiContentHash", () => {
  it("is 64 lowercase hex characters", () => {
    expect(apiContentHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  /** Computed independently: printf '%s' '<canonical>' | shasum -a 256. These
   * pin the frozen surface, including the JCS edge cases that a dependency bump
   * could plausibly disturb — an astral-plane key, -0, a large exponent, and an
   * ordered auth array. A failure here means every stored copy just became
   * unreachable, so fix the cause; never update the expected value.
   *
   * The one legitimate reason a value here moves is that the FIXTURE changed —
   * i.e. the api block's own shape did, which pre-release it still may. That
   * happened once: `sendAs` became {in, name} and `extract` became a locator
   * array, so the third fixture's hash was recomputed by hand. Proof it was the
   * input and not the algorithm: the first two fixtures carry neither field and
   * did not move. */
  const knownAnswers: [string, ApiBlock, string][] = [
    ["minimal block", minimal, "1207250d1d1886ca321f15785eda2c49adcf7493fc09735632175fd07e092956"],
    [
      "astral key, -0, large exponent, null in a body",
      {
        baseUrl: "https://x.com",
        endpoints: {
          a: { method: "POST", path: "/a", body: { "😀": [1, -0, 1e21, null], é: "x" } },
        },
      },
      "43dc01e78e9bcfbb1a3b6911feb8d408f09df1aa7ecec806e68438f85fb5ea06",
    ],
    [
      "ordered endpoint auth + auth sources",
      {
        baseUrl: "https://y.com",
        endpoints: { b: { method: "GET", path: "/b", auth: ["z", "a"] } },
        auth: {
          z: {
            source: { endpoint: "b", extract: ["t"] },
            sendAs: { in: "header", name: "H" },
          },
        },
      },
      "6419de53d00a52a5cc9588ac2c0553f2ec352bfbf17ecb82cbc88a7c9c214f24",
    ],
  ];

  it.each(knownAnswers)("matches the pinned known answer: %s", (_label, block, expected) => {
    expect(apiContentHash(block)).toBe(expected);
  });

  it("is identical for blocks differing only in key order", () => {
    expect(apiContentHash(reordered)).toBe(apiContentHash(base));
  });

  it("changes when any value changes", () => {
    const unchanged = apiContentHash(base);
    const mutations: [string, (draft: ApiBlock) => void][] = [
      [
        "baseUrl",
        (draft) => {
          draft.baseUrl = "https://old.reddit.com";
        },
      ],
      [
        "endpoint method",
        (draft) => {
          const ep = draft.endpoints.subredditHot;
          if (!ep) throw new Error("fixture missing endpoint");
          ep.method = "POST";
        },
      ],
      [
        "endpoint path",
        (draft) => {
          const ep = draft.endpoints.subredditHot;
          if (!ep) throw new Error("fixture missing endpoint");
          ep.path = "/r/{{subreddit}}/new.json";
        },
      ],
      [
        "nested graphql variable",
        (draft) => {
          const ep = draft.endpoints.search;
          if (!ep?.graphql) throw new Error("fixture missing graphql endpoint");
          ep.graphql.variables = { first: 25, query: "{{query}}" };
        },
      ],
      [
        "document body",
        (draft) => {
          draft.documents = { search: "query Search { search { docCount, after } }" };
        },
      ],
      [
        "auth header",
        (draft) => {
          const source = draft.auth?.csrf;
          if (!source) throw new Error("fixture missing auth source");
          source.sendAs.name = "X-CSRF";
        },
      ],
      [
        "added endpoint",
        (draft) => {
          draft.endpoints.me = { method: "GET", path: "/api/me.json" };
        },
      ],
      [
        "removed optional field",
        (draft) => {
          const ep = draft.endpoints.subredditHot;
          if (!ep) throw new Error("fixture missing endpoint");
          delete ep.returns;
        },
      ],
    ];

    for (const [label, mutate] of mutations) {
      expect(apiContentHash(variant(mutate)), label).not.toBe(unchanged);
    }
  });
});
