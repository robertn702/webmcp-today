import { describe, expect, it } from "vitest";
import { allowedAuthHosts } from "@/lib/auth-hosts";

describe("Preview auth hosts", () => {
  it("trusts only exact Vercel deployment hosts", () => {
    const hosts = allowedAuthHosts(
      "webmcp-today-git-improve-agent-headline-robertniimi.vercel.app",
      "webmcp-today-abc123-robertniimi.vercel.app",
    );

    expect(hosts).toContain("webmcp-today-git-improve-agent-headline-robertniimi.vercel.app");
    expect(hosts).toContain("webmcp-today-abc123-robertniimi.vercel.app");
    expect(hosts).not.toContain("webmcp-today-evil-robertniimi.attacker.vercel.app");
    expect(hosts).not.toContain("webmcp-today-tomorrow.vercel.app");
  });

  it("uses only production domains outside Vercel", () => {
    expect(allowedAuthHosts(undefined, undefined)).toEqual(["webmcp.today", "www.webmcp.today"]);
  });
});
