import { createAuthClient } from "better-auth/react";
import { multiSessionClient, usernameClient } from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";

// The username/multiSession client plugins are type-level enablers for the
// vendored better-auth-ui components (UserView/UserButton read
// `displayUsername`, call `useSetActiveSession`): they make the client
// structurally satisfy those hooks without `as` assertions. The server runs
// neither plugin, so the extra fields/methods simply go unused at runtime.
export const authClient = createAuthClient({
  plugins: [apiKeyClient(), usernameClient(), multiSessionClient()],
});
