import { configs, tools } from "@webmcp-cafe/db";
import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const [configTotals, toolTotals, topDomains] = await Promise.all([
    db.select({ value: count() }).from(configs),
    db.select({ value: count() }).from(tools),
    db
      .select({ domain: configs.domain, count: count() })
      .from(configs)
      .groupBy(configs.domain)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  return NextResponse.json({
    totalConfigs: configTotals[0]?.value ?? 0,
    totalTools: toolTotals[0]?.value ?? 0,
    topDomains,
  });
}
