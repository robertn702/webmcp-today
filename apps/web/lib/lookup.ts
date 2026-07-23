import { rankConfigsByUrl, type WebMcpConfig } from "@robertn702/webmcp-cafe-schema";
import { configs } from "@webmcp-cafe/db";
import { eq } from "drizzle-orm";
import { hydrateConfigs } from "./configs-repo";
import { db } from "./db";

/** Configs matching a page URL, most specific urlPattern first. */
export async function lookupConfigs(url: string, yolo: boolean): Promise<WebMcpConfig[]> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return [];
  }
  const rows = await db.select().from(configs).where(eq(configs.domain, hostname));
  const hydrated = await hydrateConfigs(rows, yolo);
  return rankConfigsByUrl(hydrated, url, hostname);
}
