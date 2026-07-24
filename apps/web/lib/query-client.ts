import { environmentManager, QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 5000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Canonical Next.js SSR QueryClient factory: a fresh client per server
 * request (request caches never bleed across users), a singleton in the
 * browser (stable React Query cache across navigations).
 */
export function getQueryClient() {
  if (environmentManager.isServer()) {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
