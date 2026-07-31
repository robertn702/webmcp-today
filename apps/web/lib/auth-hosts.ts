export function allowedAuthHosts(
  vercelUrl = process.env.VERCEL_URL,
  vercelBranchUrl = process.env.VERCEL_BRANCH_URL,
) {
  const hosts = ["webmcp.today", "www.webmcp.today"];

  if (vercelUrl) hosts.push(vercelUrl);
  if (vercelBranchUrl) hosts.push(vercelBranchUrl);

  return hosts;
}
