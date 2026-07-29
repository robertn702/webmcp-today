import { packages } from "@webmcp-today/db";
import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listDistinctDomains } from "@/lib/domains-repo";

export async function GET(): Promise<NextResponse> {
  const [packageTotals, domains, topDomains] = await Promise.all([
    db.select({ value: count() }).from(packages),
    listDistinctDomains(),
    db
      .select({ domain: packages.domain, count: count() })
      .from(packages)
      .groupBy(packages.domain)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  return NextResponse.json({
    totalPackages: packageTotals[0]?.value ?? 0,
    totalDomains: domains.length,
    topDomains,
  });
}
