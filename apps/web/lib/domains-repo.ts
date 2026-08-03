import { listServablePackages } from "./packages-repo";

/** Every domain with at least one published package, alphabetical. */
export async function listDistinctDomains(): Promise<string[]> {
  const valid = await listServablePackages();
  return [...new Set(valid.map((pkg) => pkg.domain))].sort();
}

/**
 * Epoch ms of the corpus's most recent change (0 if there are no packages) —
 * the `version` a client's poll compares against its stored copy.
 */
export async function getDomainsVersion(): Promise<number> {
  const valid = await listServablePackages();
  const latest = valid.reduce((max, pkg) => Math.max(max, new Date(pkg.updatedAt).getTime()), 0);
  return latest;
}
