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
