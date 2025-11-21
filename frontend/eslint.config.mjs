import reactCompiler from "eslint-plugin-react-compiler"
import prettier from "eslint-plugin-prettier"
import path from "node:path"
import { fileURLToPath } from "node:url"
import js from "@eslint/js"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/.yarn/**",
      "**/dist/**",
      "**/build/**",
      "**/.storybook/**",
      "**/storybook-static/**",
      "src/codegen/**/*",
      "src/codegen-pipeline/**/*",
      "src/components/setup/Distros.tsx",
      "**/*.config.{js,mjs,cjs,ts}",
      "**/*.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "prettier"),
  {
    plugins: {
      "react-compiler": reactCompiler,
      prettier,
    },

    rules: {
      "react-compiler/react-compiler": "error",
      "prettier/prettier": "error",
    },
  },
]
