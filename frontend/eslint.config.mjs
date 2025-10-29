import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/components/setup/Distros.tsx",
    "src/codegen/**/*",
    "src/codegen-pipeline/**/*",
    ".yarn/**",
    "public/mockServiceWorker.js",
  ]),
])

export default eslintConfig
