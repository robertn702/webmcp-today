import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postVersion } from "@/app/api/packages/[id]/versions/route";
import { POST as postPackage } from "@/app/api/packages/route";

// Versions are author-declared: 1 on create, exactly max(version)+1 on
// publish. A mismatch is an optimistic-concurrency conflict (409 carrying the
// expected number), and a concurrent publish that wins the
// uq_package_versions_package_version race maps to the same 409. There is no
// test database here: the db layer is mocked but the REAL mutations module
// runs, so the equality check itself is what gets exercised.
const state = vi.hoisted(
  (): {
    userId: string | null;
    packageRow: { id: string; contributorId: string } | null;
    maxReads: number[];
    inserts: { version?: unknown }[];
    insertError: Error | null;
  } => ({
    userId: "user-1",
    packageRow: { id: "pkg-1", contributorId: "user-1" },
    maxReads: [0],
    inserts: [],
    insertError: null,
  }),
);

vi.mock("@/lib/api-auth", () => ({
  getAuthUserId: () => Promise.resolve(state.userId),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: (fields?: unknown) => ({
      from: () => ({
        // The route's package lookup calls select() with no fields and chains
        // .limit(1); the mutations' max-version read selects { maxVersion }
        // and awaits the where() directly.
        where: () =>
          fields === undefined
            ? { limit: () => Promise.resolve(state.packageRow ? [state.packageRow] : []) }
            : Promise.resolve([
                {
                  maxVersion:
                    state.maxReads.length > 1 ? state.maxReads.shift() : state.maxReads[0],
                },
              ]),
      }),
    }),
    insert: () => ({
      values: (values: { version?: unknown }) => ({
        returning: () => {
          state.inserts.push(values);
          if (state.insertError) return Promise.reject(state.insertError);
          return Promise.resolve([{ id: "ver-new" }]);
        },
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
}));

const tool = {
  name: "search",
  description: "Search the site",
  inputSchema: { type: "object", properties: {}, required: [] },
};

const createBody = {
  version: 1,
  domain: "example.com",
  urlPatterns: ["*://example.com/*"],
  title: "Example",
  description: "Example tools",
  tools: [tool],
};

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function publish(body: unknown): Promise<Response> {
  return postVersion(post("https://webmcp.today/api/packages/pkg-1/versions", body), {
    params: Promise.resolve({ id: "pkg-1" }),
  });
}

describe("author-declared versions", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.packageRow = { id: "pkg-1", contributorId: "user-1" };
    state.maxReads = [0];
    state.inserts = [];
    state.insertError = null;
  });

  it("rejects a create declaring anything but version 1", async () => {
    const response = await postPackage(
      post("https://webmcp.today/api/packages", { ...createBody, version: 2 }),
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.expectedVersion).toBe(1);
    expect(typeof body.error).toBe("string");
    // Rejected before any insert ran.
    expect(state.inserts).toEqual([]);
  });

  it("rejects a publish whose declared version is not max(version)+1", async () => {
    state.maxReads = [2];
    const response = await publish({
      version: 2,
      urlPatterns: ["*://example.com/*"],
      tools: [tool],
    });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.expectedVersion).toBe(3);
  });

  it("accepts a publish declaring exactly max(version)+1 and inserts that number", async () => {
    state.maxReads = [2];
    const response = await publish({
      version: 3,
      urlPatterns: ["*://example.com/*"],
      tools: [tool],
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.version).toBe(3);
    expect(state.inserts[0]?.version).toBe(3);
  });

  it("maps a lost publish race (unique violation) to the same 409 with a fresh expected version", async () => {
    // Declared 3 against a max of 2, but a concurrent publish inserted 3
    // first; the re-read max is 3, so the caller should retry with 4.
    state.maxReads = [2, 3];
    state.insertError = new Error(
      'duplicate key value violates unique constraint "uq_package_versions_package_version"',
    );
    const response = await publish({
      version: 3,
      urlPatterns: ["*://example.com/*"],
      tools: [tool],
    });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.expectedVersion).toBe(4);
  });
});
