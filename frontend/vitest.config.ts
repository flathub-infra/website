import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./src", import.meta.url)),
      "@": fileURLToPath(new URL("./@", import.meta.url)),
    },
  },
  esbuild: { jsx: "automatic" },
})
