import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

// Base recommended configs
const jsRecommended = js.configs.recommended;
const tsRecommended = tseslint.configs.recommended;
const tsTypeCheckRecommended = tseslint.configs.recommendedTypeChecked;

export default [
  // General settings and ignores
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"], // Target JS/TS files only
    ignores: [
      "**/node_modules/",
      "**/dist/", // Build output
      "**/bots/", // Custom exclusion
      "**/*.test.ts", // Test files if you don’t want them linted
    ],
  },
  // JavaScript recommended rules
  jsRecommended,
  // TypeScript recommended rules (syntax-focused)
  ...tsRecommended,
  // TypeScript type-checked rules (requires tsconfig.json)
  ...tsTypeCheckRecommended,
  // Unicorn plugin for additional style and safety rules
  {
    plugins: {
      unicorn,
    },
    rules: {
      ...unicorn.configs.recommended.rules,
    },
  },
  // Disable ESLint formatting rules that conflict with Prettier
  prettier,
  // Language options for TypeScript and Node.js environment
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json", // Required for type-checked rules
      },
      globals: {
        ...globals.node, // Node.js globals
        // ...globals.browser, // Uncomment if browser code is present
        // ...globals.jest, // Uncomment if using Jest
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  // Custom rule overrides (preserving original maintainers' settings)
  {
    rules: {
      "no-undef": "error", // Ensure variables are defined
      semi: ["error", "always"], // Enforce semicolons
      curly: "warn", // Warn on missing curly braces
      "no-unused-vars": "off", // Disabled per original maintainers
      "no-unreachable": "off", // Disabled per original maintainers
      "unicorn/filename-case": "off", // Allow flexible file naming
      "unicorn/no-null": "off", // Permit null usage
      "unicorn/no-process-exit": "off", // Allow process.exit()
    },
  },
];
