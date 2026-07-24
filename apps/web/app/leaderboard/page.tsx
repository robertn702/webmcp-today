import { installs, user, webmcpDefinitions } from "@webmcp-cafe/db";
import { count, desc, eq } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [contributorRows, installRows] = await Promise.all([
    db
      .select({ id: webmcpDefinitions.contributorId, name: user.name, configCount: count() })
      .from(webmcpDefinitions)
      .innerJoin(user, eq(webmcpDefinitions.contributorId, user.id))
      .groupBy(webmcpDefinitions.contributorId, user.name)
      .orderBy(desc(count()))
      .limit(20),
    db
      .select({ id: webmcpDefinitions.contributorId, installCount: count() })
      .from(installs)
      .innerJoin(webmcpDefinitions, eq(installs.definitionId, webmcpDefinitions.id))
      .groupBy(webmcpDefinitions.contributorId),
  ]);
  const installCounts = new Map(installRows.map((r) => [r.id, r.installCount]));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Leaderboard</h1>
      {contributorRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contributors yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contributor</TableHead>
              <TableHead>Configs</TableHead>
              <TableHead>Installs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributorRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.configCount}</TableCell>
                <TableCell>{installCounts.get(row.id) ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
