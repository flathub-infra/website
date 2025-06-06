import type { Meta, StoryObj } from "@storybook/nextjs"

import SafetyRating from "./SafetyRating"

const meta = {
  component: SafetyRating,
  title: "Components/Application/SafetyRating",
} satisfies Meta<typeof SafetyRating>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    data: {
      is_free_license: true,
      metadata: {
        "flathub::verification::verified": "true",
      },
      name: "Test App",
      project_license: "GPL-3",
    },
    summaryMetadata: {
      permissions: {
        shared: ["network"],
      },
      runtimeIsEol: false,
    },
  },
}

export const EOL: Story = {
  args: {
    data: {
      is_free_license: true,
      metadata: {
        "flathub::verification::verified": "true",
      },
      name: "Test App",
      project_license: "GPL-3",
    },
    summaryMetadata: {
      permissions: {
        shared: ["network"],
      },
      runtimeIsEol: true,
    },
  },
}

export const Safe: Story = {
  args: {
    data: {
      is_free_license: true,
      metadata: {
        "flathub::verification::verified": "true",
      },
      name: "Test App",
      project_license: "GPL-3",
    },
    summaryMetadata: {
      permissions: {},
      runtimeIsEol: false,
    },
  },
}
