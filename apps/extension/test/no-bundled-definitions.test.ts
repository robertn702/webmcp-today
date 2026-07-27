import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Step 5b (U7) drops @webmcp-cafe/definitions from the extension entirely.
// Typecheck would catch a dangling import too, but a plain grep pins the
// removal even if a stray unused import ever slipped past that.

const ROOT = join(import.meta.dirname, "..");
const SCAN_DIRS = ["src", "test"];
const NEEDLE = "@webmcp-cafe/definitions";
const SELF = join(import.meta.dirname, "no-bundled-definitions.test.ts");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

describe("bundled definitions dependency removal", () => {
  it("has no source or test file referencing @webmcp-cafe/definitions", () => {
    const offenders = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)))
      .filter((file) => file !== SELF)
      .filter((file) => readFileSync(file, "utf8").includes(NEEDLE));
    expect(offenders).toEqual([]);
  });

  it("has no dependency on @webmcp-cafe/definitions in package.json", () => {
    const pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } =
      JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.dependencies?.[NEEDLE]).toBeUndefined();
    expect(pkg.devDependencies?.[NEEDLE]).toBeUndefined();
  });
});
