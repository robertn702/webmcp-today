import { schema } from "@webmcp-cafe/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "@better-auth/api-key";
import { env } from "@/env";
import { db } from "./db";

export const auth = betterAuth({
  appName: "WebMCP Cafe",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  // Agents authenticate config uploads with Bearer API keys; the plugin makes
  // auth.api.getSession resolve x-api-key headers to the key owner's session.
  plugins: [apiKey()],
});
