import { viewPaths } from "@better-auth-ui/core";
import { ensureSession } from "@better-auth-ui/react/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Settings } from "@/components/auth/settings/settings";
import { auth } from "@/lib/auth";
import { getQueryClient } from "@/lib/query-client";

export default async function SettingsPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  if (!Object.values(viewPaths.settings).includes(path)) {
    notFound();
  }

  const queryClient = getQueryClient();

  const session = await ensureSession(queryClient, auth, {
    headers: await headers(),
  });

  if (!session) {
    redirect(`/auth/sign-in?redirectTo=${encodeURIComponent(`/settings/${path}`)}`);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto w-full max-w-3xl">
        <Settings path={path} />
      </div>
    </HydrationBoundary>
  );
}
