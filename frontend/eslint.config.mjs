import { defineConfig, globalIgnores } from "eslint/config";
import reactCompiler from "eslint-plugin-react-compiler";
import prettier from "eslint-plugin-prettier";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores([
    "src/codegen/**/*",
    "src/codegen-pipeline/**/*",
    "src/components/setup/Distros.tsx",
]), {
    extends: [...compat.extends("next"), ...compat.extends("prettier")],

    plugins: {
        "react-compiler": reactCompiler,
        prettier,
    },

    rules: {
        "react-compiler/react-compiler": "error",
        "prettier/prettier": "error",
    },
}]);