import { createRequire } from "node:module";

// This package only declares `eslint` itself. typescript-eslint, @eslint/js
// and `globals` are present in the workspace (pulled in by apps/web's
// eslint-config-next) and pnpm hoists them into the virtual store's shared
// node_modules, so resolve them from there instead of adding dependencies
// just for linting.
const require = createRequire(import.meta.url);
const fromStore = (name) =>
  require(`../../node_modules/.pnpm/node_modules/${name}`);

const js = fromStore("@eslint/js");
const tseslint = fromStore("typescript-eslint/dist/index.js");
const globals = fromStore("globals");

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Reported but non-blocking: the existing codebase carries unused
      // imports and `any` types that we don't rewrite just to satisfy lint.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
