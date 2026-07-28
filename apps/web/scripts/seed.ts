/**
 * Seed the registry with the curated packages from @webmcp-cafe/curated-packages.
 * Usage: DATABASE_URL=... bun run scripts/seed.ts   (from apps/web)
 */
import { apiContentHash } from "@robertn702/webmcp-cafe-schema";
import { createDb, packages, packageVersions, user } from "@webmcp-cafe/db";
import { curatedPackages } from "@webmcp-cafe/curated-packages";

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

for (const input of curatedPackages) {
  const [pkg] = await db
    .insert(packages)
    .values({
      domain: input.domain,
      pageType: input.pageType,
      title: input.title,
      description: input.description,
      contributorId: SEED_USER_ID,
    })
    .returning({ id: packages.id });
  if (!pkg) {
    console.log(`skip ${input.domain}: insert returned no row`);
    continue;
  }
  await db.insert(packageVersions).values({
    packageId: pkg.id,
    version: 1,
    urlPatterns: input.urlPatterns,
    tools: input.tools,
    api: input.api,
    apiContentHash: input.api ? apiContentHash(input.api) : null,
    minEngine: input.minEngine,
    changelog: input.changelog,
  });
  console.log(`seeded ${input.domain} → ${pkg.id} (0 installs)`);
}
