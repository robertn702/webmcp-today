import { configs, user, votes } from "@webmcp-cafe/db";
import { count, desc, eq, sum } from "drizzle-orm";
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
  const [contributorRows, voteRows] = await Promise.all([
    db
      .select({ id: configs.contributorId, name: user.name, configCount: count() })
      .from(configs)
      .innerJoin(user, eq(configs.contributorId, user.id))
      .groupBy(configs.contributorId, user.name)
      .orderBy(desc(count()))
      .limit(20),
    db
      .select({ id: configs.contributorId, score: sum(votes.value) })
      .from(votes)
      .innerJoin(configs, eq(votes.configId, configs.id))
      .groupBy(configs.contributorId),
  ]);
  const scores = new Map(voteRows.map((r) => [r.id, Number(r.score ?? 0)]));

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
              <TableHead>Net votes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributorRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.configCount}</TableCell>
                <TableCell>{scores.get(row.id) ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
