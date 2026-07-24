import { installs, webmcpDefinitions } from "@webmcp-cafe/db";
import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const [configTotals, installTotals, topDomains] = await Promise.all([
    db.select({ value: count() }).from(webmcpDefinitions),
    db.select({ value: count() }).from(installs),
    db
      .select({ domain: webmcpDefinitions.domain, count: count() })
      .from(webmcpDefinitions)
      .groupBy(webmcpDefinitions.domain)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  return NextResponse.json({
    totalConfigs: configTotals[0]?.value ?? 0,
    totalInstalls: installTotals[0]?.value ?? 0,
    topDomains,
  });
}
