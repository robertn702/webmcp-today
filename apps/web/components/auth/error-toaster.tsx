import { authMutationKeys, authQueryKeys } from "@better-auth-ui/core";
import { matchMutation, matchQuery, useQueryClient } from "@tanstack/react-query";
import type { BetterFetchError } from "better-auth/react";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Auth query/mutation errors are better-auth fetch errors (Error instances
 * carrying an optional structured `error` payload). Anything else isn't an
 * auth error surface, so don't toast it.
 */
function isBetterFetchError(error: unknown): error is BetterFetchError {
  return error instanceof Error;
}

export function ErrorToaster() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const queryCache = queryClient.getQueryCache();
    const previousQueryOnError = queryCache.config.onError;

    queryCache.config.onError = (error, query) => {
      previousQueryOnError?.(error, query);

      if (!matchQuery({ queryKey: authQueryKeys.all }, query)) return;
      if (!isBetterFetchError(error)) return;

      if (error.error?.code === "EMAIL_NOT_VERIFIED") return;
      if (error.error) toast.error(error.error.message);
    };

    const mutationCache = queryClient.getMutationCache();
    const previousMutationOnError = mutationCache.config.onError;

    mutationCache.config.onError = (error, variables, onMutateResult, mutation, context) => {
      previousMutationOnError?.(error, variables, onMutateResult, mutation, context);

      if (!matchMutation({ mutationKey: authMutationKeys.all }, mutation)) {
        return;
      }
      if (!isBetterFetchError(error)) return;

      if (error.error?.code === "EMAIL_NOT_VERIFIED") return;
      toast.error(error.error?.message || error.message);
    };

    return () => {
      queryCache.config.onError = previousQueryOnError;
      mutationCache.config.onError = previousMutationOnError;
    };
  }, [queryClient]);

  return null;
}
