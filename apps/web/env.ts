import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  },
  client: {
    // Comma-separated extension IDs the install button probes (dev-key ID +
    // the CWS-assigned ID once it exists). Optional: unset means the button
    // always falls back to "install the extension".
    NEXT_PUBLIC_WEBMCP_EXTENSION_IDS: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_WEBMCP_EXTENSION_IDS: process.env.NEXT_PUBLIC_WEBMCP_EXTENSION_IDS,
  },
});
