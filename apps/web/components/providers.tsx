"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { apiKeyPlugin } from "@/lib/auth/api-key-plugin";
import { getQueryClient } from "@/lib/query-client";
import { AuthProvider } from "./auth/auth-provider";
import { Toaster } from "./ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        authClient={authClient}
        // GitHub OAuth only — the server has no email/password, so the
        // password forms (sign-up, forgot/reset password) stay disabled.
        emailAndPassword={{ enabled: false }}
        socialProviders={["github"]}
        navigate={({ to, replace }) => (replace ? router.replace(to) : router.push(to))}
        plugins={[apiKeyPlugin()]}
        Link={Link}
      >
        {children}

        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
