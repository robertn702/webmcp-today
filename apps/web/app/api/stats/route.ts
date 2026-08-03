import { NextResponse } from "next/server";
import { listServablePackages } from "@/lib/packages-repo";

export async function GET(): Promise<NextResponse> {
  const packages = await listServablePackages();
  const counts = new Map<string, number>();
  for (const pkg of packages) counts.set(pkg.domain, (counts.get(pkg.domain) ?? 0) + 1);
  const rankedDomains = [...counts]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return NextResponse.json({
    totalPackages: packages.length,
    totalDomains: counts.size,
    topDomains: rankedDomains,
  });
}
