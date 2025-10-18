import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import SafetyRating from "./SafetyRating"
import { getSafetyRating } from "../../safety"

const meta = {
  component: SafetyRating,
  title: "Components/Application/SafetyRating",
} satisfies Meta<typeof SafetyRating>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    appName: "Test App",
    safetyRating: getSafetyRating(
      {
        is_free_license: true,
        metadata: {
          "flathub::verification::verified": "true",
        },
        project_license: "GPL-3",
      },
      {
        permissions: {
          shared: ["network"],
        },
        runtimeIsEol: false,
      },
    ),
  },
}

export const EOL: Story = {
  args: {
    appName: "Test App",
    safetyRating: getSafetyRating(
      {
        is_free_license: true,
        metadata: {
          "flathub::verification::verified": "true",
        },
        project_license: "GPL-3",
      },
      {
        permissions: {
          shared: ["network"],
        },
        runtimeIsEol: true,
      },
    ),
  },
}

export const Safe: Story = {
  args: {
    appName: "Test App",
    safetyRating: getSafetyRating(
      {
        is_free_license: true,
        metadata: {
          "flathub::verification::verified": "true",
        },
        project_license: "GPL-3",
      },
      {
        permissions: {},
        runtimeIsEol: false,
      },
    ),
  },
}
