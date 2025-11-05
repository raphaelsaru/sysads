import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

let storybookConfigs = [];

try {
  // eslint-plugin-storybook is opcional em ambientes sem dependências de desenvolvimento.
  const storybookModule = await import("eslint-plugin-storybook");
  const configs = storybookModule?.default?.configs ?? storybookModule?.configs;

  if (configs?.["flat/recommended"]) {
    storybookConfigs = configs["flat/recommended"];
  }
} catch (error) {
  console.warn("[eslint] eslint-plugin-storybook não disponível, ignorando configurações específicas.");
}

const eslintConfig = [...compat.extends("next/core-web-vitals", "next/typescript"), {
  rules: {
    "react-hooks/exhaustive-deps": "warn",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
  },
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ],
}, ...storybookConfigs];

export default eslintConfig;
