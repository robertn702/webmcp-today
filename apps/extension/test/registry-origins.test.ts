import { describe, expect, it } from "vitest";
import { isAllowedRegistryOrigin } from "../src/lib/registry-origins.js";

describe("isAllowedRegistryOrigin", () => {
  it.each([
    "https://webmcp.cafe",
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
  ])("accepts %s", (origin) => {
    expect(isAllowedRegistryOrigin(origin)).toBe(true);
  });

  it.each([
    // https localhost is NOT covered by the http://localhost/* match pattern
    "https://localhost",
    "https://localhost:3000",
    // prod registry over plain http, and any subdomain of it
    "http://webmcp.cafe",
    "https://www.webmcp.cafe",
    "https://evil.webmcp.cafe",
    // lookalikes
    "http://localhost.evil.com",
    "https://webmcp.cafe.evil.com",
    "https://evil.com",
    // junk
    "not a url",
    "",
    "webmcp.cafe",
  ])("rejects %s", (origin) => {
    expect(isAllowedRegistryOrigin(origin)).toBe(false);
  });
});
