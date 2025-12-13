import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["**/*.js", "**/*.mjs", "node_modules/**"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Match Obsidian's stricter sentence case checking
      // Brand names with unusual capitalization
      "obsidianmd/ui/sentence-case": [
        "error",
        {
          enforceCamelCaseLower: true,
          brands: ["reMarkable", "Excalidraw", "ReMarkSync"],
          acronyms: ["PDF", "PDFs"],
        },
      ],
      // Relax some strict TypeScript rules for this project
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
]);
