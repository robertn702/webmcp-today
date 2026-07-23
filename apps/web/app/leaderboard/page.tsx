import { configs, user, votes } from "@webmcp-cafe/db";
import { count, desc, eq, sum } from "drizzle-orm";
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
        <p className="text-sm text-stone-500">No contributors yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left text-xs text-stone-500">
              <th className="py-2">Contributor</th>
              <th className="py-2">Configs</th>
              <th className="py-2">Net votes</th>
            </tr>
          </thead>
          <tbody>
            {contributorRows.map((row) => (
              <tr key={row.id} className="border-b border-stone-200">
                <td className="py-2">{row.name}</td>
                <td className="py-2">{row.configCount}</td>
                <td className="py-2">{scores.get(row.id) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
