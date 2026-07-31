import { schema } from "@webmcp-today/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "@better-auth/api-key";
import { oAuthProxy } from "better-auth/plugins/oauth-proxy";
import { env } from "@/env";
import { db } from "./db";
import { allowedAuthHosts } from "./auth-hosts";

export const auth = betterAuth({
  appName: "WebMCP Today",
  baseURL: {
    allowedHosts: allowedAuthHosts(),
    fallback: env.BETTER_AUTH_URL,
  },
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Email/password alongside GitHub OAuth. No email sender is configured, so
  // verification and password-reset emails are off (the UI hides those flows).
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  // Agents authenticate package uploads with Bearer API keys. `enableSessionForAPIKeys`
  // is what makes auth.api.getSession resolve an x-api-key header to the key owner's
  // session, and it defaults to *false* — without it the plugin's before-hook matcher
  // skips every request and getSession silently returns null (not an error), so every
  // agent write path 401s. Don't drop it.
  plugins: [
    apiKey({ enableSessionForAPIKeys: true }),
    oAuthProxy({
      // Unset locally so the separate dev GitHub OAuth App keeps its localhost
      // callback. Vercel Preview and Production both set this to webmcp.today.
      productionURL: env.OAUTH_PROXY_PRODUCTION_URL,
      // This only encrypts the cross-environment OAuth handoff. It is deliberately
      // distinct from each environment's session-signing BETTER_AUTH_SECRET.
      secret: env.OAUTH_PROXY_SECRET,
    }),
  ],
});
