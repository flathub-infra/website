import type { StorybookConfig } from "@storybook/nextjs-vite"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: [
    "../{app,src,@}/**/*.mdx",
    "../{app,src,@}/**/*.stories.@(js|jsx|ts|tsx)",
  ],

  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-onboarding",
    "@storybook/addon-links",
    "@storybook/addon-themes",
    "@storybook/addon-a11y",
    "storybook-addon-mock-date",
    "@storybook/addon-docs",
    "@storybook/addon-vitest",
    "storybook-next-intl",
  ],

  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },

  staticDirs: ["../public"],

  async viteFinal(config) {
    return {
      ...config,
      // Storybook serves static assets through staticDirs.
      publicDir: false,
      resolve: {
        ...(config.resolve ?? {}),
        alias: {
          ...(config.resolve?.alias ?? {}),
          "@": path.resolve(__dirname, "../@"),
          "src/utils/imgproxy": path.resolve(__dirname, "./mocks/imgproxy.ts"),
          src: path.resolve(__dirname, "../src"),
          "@imgproxy/imgproxy-node": path.resolve(
            __dirname,
            "./mocks/imgproxy-node.ts",
          ),
        },
      },
    }
  },
}

export default config
