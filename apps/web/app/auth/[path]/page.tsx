import { viewPaths } from "@better-auth-ui/core";
import { notFound } from "next/navigation";
import { Auth } from "@/components/auth/auth";

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  if (!Object.values(viewPaths.auth).includes(path)) {
    notFound();
  }

  return (
    <div className="my-auto flex justify-center p-4 md:p-6">
      <Auth path={path} />
    </div>
  );
}
