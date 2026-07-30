import { viewPaths } from "@better-auth-ui/core";
import { notFound } from "next/navigation";
import { Auth } from "@/components/auth/auth";

// Branded header only where the copy makes sense — utility views (sign-out,
// verify-email, …) get just the card over the atmosphere.
const HEADERS: Record<string, { title: string; lede: string }> = {
  "sign-in": {
    title: "Welcome back.",
    lede: "Sign in to publish packages, pin installs, and manage your API keys.",
  },
  "sign-up": {
    title: "Create your account.",
    lede: "One account to publish packages and pin the installs the extension delivers.",
  },
};

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  if (!Object.values(viewPaths.auth).includes(path)) {
    notFound();
  }

  const header = HEADERS[path];

  return (
    // Lives outside the (registry) group (like the landing page) so the
    // atmosphere layers are full-bleed rather than clipped by max-w-5xl.
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div className="cafe-atmosphere pointer-events-none absolute inset-0" aria-hidden />
      <div className="cafe-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative flex w-full flex-col items-center gap-8">
        {header ? (
          <header className="cafe-rise max-w-md text-center">
            <p className="font-mono text-[11px] tracking-[0.2em] text-brand uppercase">
              WebMCP tool registry
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
              {header.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{header.lede}</p>
          </header>
        ) : null}

        <div className="cafe-rise flex w-full justify-center [animation-delay:120ms]">
          <Auth path={path} />
        </div>
      </div>
    </div>
  );
}
