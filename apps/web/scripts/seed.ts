/**
 * Seed the registry with the extension's bundled configs.
 * Usage: DATABASE_URL=... bun run scripts/seed.ts   (from apps/web)
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createConfigSchema } from "@robertn702/webmcp-cafe-schema";
import { configs, createDb, tools, user } from "@webmcp-cafe/db";

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
  const [row] = await db
    .insert(configs)
    .values({
      domain: input.domain,
      urlPattern: input.urlPattern,
      pageType: input.pageType,
      title: input.title,
      description: input.description,
      tags: input.tags,
      minEngine: input.minEngine,
      contributorId: SEED_USER_ID,
    })
    .onConflictDoNothing()
    .returning({ id: configs.id });
  if (!row) {
    console.log(`exists ${file}`);
    continue;
  }
  await db.insert(tools).values(
    input.tools.map((tool) => ({
      configId: row.id,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      execution: tool.execution,
    })),
  );
  console.log(`seeded ${file} → ${row.id}`);
}
