import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webMcpPackageSchema, type WebMcpPackage } from "@robertn702/webmcp-cafe-schema";
import type { PageLoadPackages } from "../src/lib/local-lookup.js";
import type { ModelContextLike } from "../src/lib/model-context.js";
import { runRegistrationPass, type RegistrationDeps } from "../src/lib/register-tools.js";
import { WEBMCP_FLAG_URL, type PageStatus } from "../src/lib/status.js";

const PAGE_URL = "https://en.wikipedia.org/wiki/Coffee";

function pkg(...toolNames: string[]): WebMcpPackage {
  return webMcpPackageSchema.parse({
    id: "pkg-wiki",
    versionId: "ver-1",
    version: 1,
    contributor: "robert",
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    domain: "en.wikipedia.org",
    urlPatterns: ["*://en.wikipedia.org/wiki/*"],
    title: "Wikipedia article",
    description: "Fixture package",
    tools: toolNames.map((name) => ({
      name,
      description: `${name} fixture tool`,
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execution: {
        mode: "dom",
        selector: "body",
        autosubmit: false,
        resultSelector: "p",
        resultExtract: "text",
      },
    })),
  });
}

/** Records what was registered; `reject` names make registerTool fail. */
function recordingContext(reject: string[] = []): {
  mc: ModelContextLike;
  registered: string[];
  signals: Array<AbortSignal | undefined>;
} {
  const registered: string[] = [];
  const signals: Array<AbortSignal | undefined> = [];
  const mc: ModelContextLike = {
    registerTool: async (descriptor, options) => {
      if (reject.includes(descriptor.name)) throw new Error("duplicate tool name");
      registered.push(descriptor.name);
      signals.push(options?.signal);
    },
  };
  return { mc, registered, signals };
}

function harness(
  load: WebMcpPackage[] | PageLoadPackages,
  mc: ModelContextLike | undefined,
  declared: string[] = [],
): { deps: RegistrationDeps; statuses: PageStatus[]; getModelContext: () => unknown } {
  const result: PageLoadPackages = Array.isArray(load) ? { packages: load } : load;
  const statuses: PageStatus[] = [];
  const getModelContext = vi.fn(() => mc);
  const deps: RegistrationDeps = {
    loadPackages: vi.fn(async () => result),
    getModelContext,
    siteDeclaredToolNames: () => new Set(declared),
    reportStatus: (status) => {
      statuses.push(status);
    },
  };
  return { deps, statuses, getModelContext };
}

describe("runRegistrationPass", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays silent on a page with no matching packages, without probing WebMCP", async () => {
    const { deps, statuses, getModelContext } = harness([], undefined);

    await runRegistrationPass(PAGE_URL, new AbortController().signal, deps);

    expect(statuses).toEqual([{ kind: "no-packages" }]);
    // Order matters: probing first would warn about the flag on every page.
    expect(getModelContext).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns with enablement steps when packages match but WebMCP is absent", async () => {
    const { deps, statuses } = harness([pkg("wiki_summary")], undefined);

    await runRegistrationPass(PAGE_URL, new AbortController().signal, deps);

    expect(statuses).toEqual([{ kind: "webmcp-unavailable", packageCount: 1 }]);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain(WEBMCP_FLAG_URL);
    expect(message).toContain("WebMCP for testing");
    expect(message).toContain("relaunch Chrome");
  });

  it("registers matching tools and reports their names", async () => {
    const { mc, registered } = recordingContext();
    const { deps, statuses } = harness([pkg("wiki_summary", "wiki_search")], mc);

    await runRegistrationPass(PAGE_URL, new AbortController().signal, deps);

    expect(registered).toEqual(["wiki_summary", "wiki_search"]);
    expect(statuses).toEqual([{ kind: "registered", toolNames: ["wiki_summary", "wiki_search"] }]);
  });

  it("skips tools that collide with a site-declared tool", async () => {
    const { mc, registered } = recordingContext();
    const { deps, statuses } = harness([pkg("wiki_summary", "wiki_search")], mc, ["wiki_search"]);

    await runRegistrationPass(PAGE_URL, new AbortController().signal, deps);

    expect(registered).toEqual(["wiki_summary"]);
    expect(statuses).toEqual([{ kind: "registered", toolNames: ["wiki_summary"] }]);
  });

  it("registers every tool with the pass signal, so navigation can drop them", async () => {
    const { mc, signals } = recordingContext();
    const { deps } = harness([pkg("wiki_summary", "wiki_search")], mc);
    const controller = new AbortController();

    await runRegistrationPass(PAGE_URL, controller.signal, deps);

    expect(signals).toEqual([controller.signal, controller.signal]);
  });

  it("registers nothing and reports nothing when the pass is aborted mid-lookup", async () => {
    const { mc, registered } = recordingContext();
    const controller = new AbortController();
    const statuses: PageStatus[] = [];
    const deps: RegistrationDeps = {
      loadPackages: async () => {
        controller.abort();
        return { packages: [pkg("wiki_summary")] };
      },
      getModelContext: () => mc,
      siteDeclaredToolNames: () => new Set(),
      reportStatus: (status) => statuses.push(status),
    };

    await runRegistrationPass(PAGE_URL, controller.signal, deps);

    expect(registered).toEqual([]);
    // The pass that superseded this one owns the badge.
    expect(statuses).toEqual([]);
  });

  it("stops registering as soon as the signal aborts mid-pass", async () => {
    const controller = new AbortController();
    const registered: string[] = [];
    const mc: ModelContextLike = {
      registerTool: async (descriptor) => {
        registered.push(descriptor.name);
        controller.abort();
      },
    };
    const { deps, statuses } = harness([pkg("wiki_summary", "wiki_search")], mc);

    await runRegistrationPass(PAGE_URL, controller.signal, deps);

    expect(registered).toEqual(["wiki_summary"]);
    expect(statuses).toEqual([]);
  });

  it("keeps going when registerTool rejects, and leaves the tool out of the status", async () => {
    const { mc, registered } = recordingContext(["wiki_summary"]);
    const { deps, statuses } = harness([pkg("wiki_summary", "wiki_search")], mc);

    await runRegistrationPass(PAGE_URL, new AbortController().signal, deps);

    expect(registered).toEqual(["wiki_search"]);
    expect(statuses).toEqual([{ kind: "registered", toolNames: ["wiki_search"] }]);
  });

  it("registers nothing and reports site-blocked when the site forbids WebMCP (SecurityError)", async () => {
    const registered: string[] = [];
    const mc: ModelContextLike = {
      registerTool: async () => {
        // What Chrome throws on a Permissions-Policy: tools=() page.
        throw new DOMException(
          "WebMCP is disallowed by Permissions-Policy on this page",
          "SecurityError",
        );
      },
    };
    const { deps, statuses } = harness([pkg("wiki_summary", "wiki_search")], mc);

    await runRegistrationPass(PAGE_URL, new AbortController().signal, deps);

    expect(registered).toEqual([]);
    expect(statuses).toEqual([{ kind: "site-blocked", packageCount: 1 }]);
  });

  it("treats other registerTool errors as per-tool skips, not site-blocked", async () => {
    const registered: string[] = [];
    const mc: ModelContextLike = {
      registerTool: async (descriptor) => {
        if (descriptor.name === "wiki_summary") {
          throw new DOMException("quota exceeded", "QuotaExceededError");
        }
        registered.push(descriptor.name);
      },
    };
    const { deps, statuses } = harness([pkg("wiki_summary", "wiki_search")], mc);

    await runRegistrationPass(PAGE_URL, new AbortController().signal, deps);

    expect(registered).toEqual(["wiki_search"]);
    expect(statuses).toEqual([{ kind: "registered", toolNames: ["wiki_search"] }]);
  });

  it("reports safety-list-missing when the fail-closed gate blocks the pass", async () => {
    const { deps, statuses, getModelContext } = harness(
      { packages: [], blocked: "no-revocation-list" },
      undefined,
    );

    await runRegistrationPass(PAGE_URL, new AbortController().signal, deps);

    expect(statuses).toEqual([{ kind: "safety-list-missing" }]);
    expect(getModelContext).not.toHaveBeenCalled();
  });

  it("reports storage-unreadable when storage was written by a newer build", async () => {
    const { deps, statuses } = harness({ packages: [], blocked: "storage-unreadable" }, undefined);

    await runRegistrationPass(PAGE_URL, new AbortController().signal, deps);

    expect(statuses).toEqual([{ kind: "storage-unreadable" }]);
  });
});
