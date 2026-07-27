/**
 * Seed the registry with the curated configs from @webmcp-cafe/definitions.
 * Usage: DATABASE_URL=... bun run scripts/seed.ts   (from apps/web)
 */
import { apiContentHash } from "@robertn702/webmcp-cafe-schema";
import { createDb, definitionVersions, user, webmcpDefinitions } from "@webmcp-cafe/db";
import { definitions } from "@webmcp-cafe/definitions";

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

for (const input of definitions) {
  const [definition] = await db
    .insert(webmcpDefinitions)
    .values({
      domain: input.domain,
      pageType: input.pageType,
      title: input.title,
      description: input.description,
      contributorId: SEED_USER_ID,
    })
    .returning({ id: webmcpDefinitions.id });
  if (!definition) {
    console.log(`skip ${input.domain}: insert returned no row`);
    continue;
  }
  await db.insert(definitionVersions).values({
    definitionId: definition.id,
    version: 1,
    urlPatterns: input.urlPatterns,
    tools: input.tools,
    api: input.api,
    apiContentHash: input.api ? apiContentHash(input.api) : null,
    minEngine: input.minEngine,
    changelog: input.changelog,
  });
  console.log(`seeded ${input.domain} → ${definition.id} (0 installs)`);
}
