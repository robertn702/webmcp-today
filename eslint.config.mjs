import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

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
      ".agents/**",
      ".claude/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
  prettier,
);
