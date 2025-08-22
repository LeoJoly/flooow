import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";


export default defineConfig([
  {
    files: ["**/*.ts"],

    languageOptions: {
      parser: tsparser,
      sourceType: "module",
    },

    plugins: {
      "@typescript-eslint": tseslint,
      prettier: prettierPlugin,
    },

    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      "semi": ["error", "never"],
      "quotes": ["error", "single"],
      "prettier/prettier": [
        "error",
        {
          "endOfLine": "auto"
        }
      ]
    },
  },
]);
