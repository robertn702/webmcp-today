/**
 * Seed the registry with the extension's bundled configs.
 * Usage: DATABASE_URL=... bun run scripts/seed.ts   (from apps/web)
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createConfigSchema } from "@robertn702/webmcp-cafe-schema";
import { createDb, definitionVersions, user, webmcpDefinitions } from "@webmcp-cafe/db";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const db = createDb(databaseUrl);

const SEED_USER_ID = "seed-webmcp-cafe";
await db
  .insert(user)
  .values({
    id: SEED_USER_ID,
    name: "webmcp-cafe",
    email: "seed@webmcp.cafe",
    emailVerified: true,
  })
  .onConflictDoNothing();

const configsDir = join(import.meta.dirname, "../../extension/configs");
for (const file of (await readdir(configsDir)).filter((f) => f.endsWith(".json"))) {
  const raw: unknown = JSON.parse(await readFile(join(configsDir, file), "utf8"));
  const parsed = createConfigSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`skip ${file}: ${parsed.error.message}`);
    continue;
  }
  const input = parsed.data;
  const [definition] = await db
    .insert(webmcpDefinitions)
    .values({
      domain: input.domain,
      pageType: input.pageType,
      title: input.title,
      description: input.description,
      tags: input.tags,
      contributorId: SEED_USER_ID,
    })
    .returning({ id: webmcpDefinitions.id });
  if (!definition) {
    console.log(`skip ${file}: insert returned no row`);
    continue;
  }
  await db.insert(definitionVersions).values({
    definitionId: definition.id,
    version: 1,
    urlPatterns: input.urlPatterns,
    tools: input.tools,
    minEngine: input.minEngine,
    changelog: input.changelog,
  });
  console.log(`seeded ${file} → ${definition.id} (0 installs)`);
}
