import { readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// FSD layer order, low to high. A layer may only import from layers below it.
const LAYERS = ["shared", "entities", "features", "widgets", "app"];

const restrict = (group, message) => ({
  "no-restricted-imports": ["error", { patterns: [{ group, message }] }],
});

const layerRules = LAYERS.slice(0, -1).map((layer, i) => {
  const upper = LAYERS.slice(i + 1);
  return {
    files: [`src/${layer}/**`],
    rules: restrict(
      upper.flatMap((l) => [`@/${l}`, `@/${l}/**`]),
      `FSD: ${layer}/ cannot import from ${upper.join("/, ")}/. Dependencies point downward only — lift the shared part into a lower layer, or compose it a layer up.`,
    ),
  };
});

// features/ slices may not import each other, but may import themselves.
const sliceRules = readdirSync(new URL("./src/features", import.meta.url), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((slice) => ({
    files: [`src/features/${slice.name}/**`],
    rules: restrict(
      ["@/features/*", "@/features/*/**", `!@/features/${slice.name}`, `!@/features/${slice.name}/**`],
      "FSD: features/ slices cannot import each other. Lift the shared part into shared/ or entities/, or compose both slices in a widget.",
    ),
  }));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...layerRules,
  ...sliceRules,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
