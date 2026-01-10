import reactCompiler from "eslint-plugin-react-compiler"
import prettier from "eslint-plugin-prettier"
import prettierConfig from "eslint-config-prettier"
import nextPlugin from "@next/eslint-plugin-next"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"
import jsxA11yPlugin from "eslint-plugin-jsx-a11y"
import typescriptEslint from "typescript-eslint"
import globals from "globals"

export default typescriptEslint.config(
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
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: typescriptEslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      "react-compiler": reactCompiler,
      "@typescript-eslint": typescriptEslint.plugin,
      prettier,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      "react-compiler/react-compiler": "error",
      "prettier/prettier": "error",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
  prettierConfig,
)
