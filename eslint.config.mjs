import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import turbo from "eslint-plugin-turbo";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.output/**",
      "**/.wxt/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      ".agents/**",
      ".claude/**",
       "**/.context/**",
       "**/.scratch/**",
       "**/.source/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Monorepo-wide: flag process.env vars not declared in turbo.json.
  turbo.configs["flat/recommended"],
  {
    rules: {
      // Repo rule: no `as` type assertions except `as const`.
      // Validate at boundaries with zod; narrow with runtime checks.
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression:not([typeAnnotation.typeName.name='const'])",
          message:
            "No `as` type assertions (except `as const`). Validate with zod or narrow with runtime checks.",
        },
        {
          selector: "TSTypeAssertion",
          message: "No angle-bracket type assertions.",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // React + Next.js lint coverage, scoped to the web app. The extension is
  // plain-TS content scripts (no React), so hooks rules don't apply there.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // App Router project: no /pages dir, so this pages-router rule only emits
      // a "Pages directory cannot be found" notice on every run. Off.
      "@next/next/no-html-link-for-pages": "off",
      // Core React hooks correctness. Intentionally the classic rule pair rather
      // than eslint-plugin-react-hooks v7's full React-Compiler suite — this
      // matches the intended "rules-of-hooks + missing deps" coverage and the
      // repo's simplicity bias.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  prettier,
);
