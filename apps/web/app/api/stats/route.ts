import { installs, packages } from "@webmcp-cafe/db";
import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const [packageTotals, installTotals, topDomains] = await Promise.all([
    db.select({ value: count() }).from(packages),
    db.select({ value: count() }).from(installs),
    db
      .select({ domain: packages.domain, count: count() })
      .from(packages)
      .groupBy(packages.domain)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  return NextResponse.json({
    totalPackages: packageTotals[0]?.value ?? 0,
    totalInstalls: installTotals[0]?.value ?? 0,
    topDomains,
  });
}
