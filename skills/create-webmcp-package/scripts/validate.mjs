#!/usr/bin/env node

/* global console, process */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPackageSchema } from "@webmcp-today/schema";

if (process.argv.length !== 3) {
  console.error("Usage: node validate.mjs <webmcp-package.json>");
  process.exit(1);
}

const packagePath = resolve(process.argv[2]);
let value;

try {
  value = JSON.parse(await readFile(packagePath, "utf8"));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to read JSON at ${packagePath}: ${message}`);
  process.exit(1);
}

const result = createPackageSchema.safeParse(value);

if (!result.success) {
  console.error(`Invalid WebMCP Today package: ${packagePath}`);
  for (const issue of result.error.issues) {
    const path = issue.path.reduce(
      (current, segment) =>
        typeof segment === "number" ? `${current}[${segment}]` : `${current}.${segment}`,
      "$",
    );
    console.error(`${path}: ${issue.message}`);
  }
  process.exit(1);
}

const pkg = result.data;
const toolNames = pkg.tools.map((tool) => tool.name).join(", ");
console.log(
  `Valid WebMCP Today package: ${pkg.title} (${pkg.domain}) v${pkg.version}; ${pkg.tools.length} tool(s) [${toolNames}]; ${Object.keys(pkg.api.endpoints).length} endpoint(s); minEngine ${pkg.minEngine}.`,
);
