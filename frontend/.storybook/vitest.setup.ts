import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview"
import { setProjectAnnotations } from "@storybook/nextjs-vite"
import { beforeAll } from "vitest"

import * as projectAnnotations from "./preview"

const project = setProjectAnnotations([
  projectAnnotations,
  a11yAddonAnnotations,
])

beforeAll(project.beforeAll)
