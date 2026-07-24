import { createAuthPlugin } from "@better-auth-ui/core";
import {
  type ApiKeyPluginOptions,
  apiKeyPlugin as coreApiKeyPlugin,
} from "@better-auth-ui/core/plugins";

import { ApiKeys } from "@/components/auth/api-key/api-keys";

// Organization-owned keys are not supported (no organization plugin
// server-side), so `ApiKeyPluginOptions.organization` stays disabled and the
// registry's OrganizationApiKeys wrapper is intentionally not wired up.
export const apiKeyPlugin = createAuthPlugin(
  coreApiKeyPlugin.id,
  (options: ApiKeyPluginOptions = {}) => {
    const core = coreApiKeyPlugin(options);

    return {
      ...core,
      securityCards: [ApiKeys],
    };
  },
);
