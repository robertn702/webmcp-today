import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches are ad hoc — `neon checkout <name>` to test a
      // risky migration in isolation before applying it to main. Keep them
      // cheap and short-lived; nothing provisions them automatically, so a
      // 7d TTL cleans up after a forgotten experiment.
      return {
        parent: "main",
        ttl: "7d",
        postgres: {
          computeSettings: {
            autoscalingLimitMinCu: 0.25,
            autoscalingLimitMaxCu: 1,
            suspendTimeout: "5m",
          },
        },
      };
    }
    // Existing branch: no changes
    return {};
  },
});
