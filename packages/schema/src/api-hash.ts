import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import canonicalize from "canonicalize";
import type { ApiBlock } from "./api.js";

// A stable content identifier for an api block. The same logical surface
// recurs across a package's versions and across rival packages targeting the
// same site, so the hash lets a client recognise a surface it already holds
// (docs/local-first-installs.md). Bodies are stored whole — nothing on disk
// is keyed by this hash.
//
// The canonical form is therefore a FROZEN COMPATIBILITY SURFACE: any change to
// it invalidates every copy a client already has. It is derived from the value
// alone — never from Postgres jsonb text, and never from incidental
// JSON.stringify key order.
//
// It is JSON Canonicalization Scheme (RFC 8785), so a client that is not this
// package — a non-JS service, or a third party reimplementing the dedupe — has
// a published spec to target instead of our source. Being a frozen *spec* is
// also what makes taking it as a runtime dependency safe: there is no edge case
// a bump could legitimately "fix", and test/api-hash.test.ts pins known-answer
// hashes so a bump that changed the output would fail loudly.

/**
 * Canonical string form of an api block: object keys sorted recursively, array
 * order preserved, numbers in a stable representation. Storage-independent and
 * consumer-independent — two logically identical blocks always agree.
 *
 * This is JSON Canonicalization Scheme (RFC 8785).
 */
export function canonicalizeApiBlock(api: ApiBlock): string {
  const canonical = canonicalize(api);
  // Only for values JSON cannot represent at all (a bare undefined, a
  // function). An ApiBlock is an object, so this is unreachable in practice.
  if (canonical === undefined) throw new Error("Cannot canonicalize api block");
  return canonical;
}

/**
 * Lowercase-hex sha256 of {@link canonicalizeApiBlock}.
 *
 * Deliberately not node:crypto: the extension bundles this package for the
 * browser, and rollup hard-fails on `node:crypto` ("createHash is not exported
 * by __vite-browser-external"). @noble/hashes is pure JS, so it bundles
 * anywhere and stays synchronous.
 */
export function apiContentHash(api: ApiBlock): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonicalizeApiBlock(api))));
}
