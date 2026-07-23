import { auth } from "./auth";

/**
 * Resolve the acting user from a browser cookie session or an agent API key.
 * Accepts keys as `Authorization: Bearer <key>` (docs style) by mapping them
 * to the `x-api-key` header better-auth's apiKey plugin resolves.
 */
export async function getAuthUserId(request: Request): Promise<string | null> {
  const requestHeaders = new Headers(request.headers);
  const authorization = requestHeaders.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ") && !requestHeaders.has("x-api-key")) {
    requestHeaders.set("x-api-key", authorization.slice("bearer ".length));
  }
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session?.user.id ?? null;
}
