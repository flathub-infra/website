import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import Badges from "../pages/badges"

const meta = {
  component: Badges,
  title: "pages/badges",
} satisfies Meta<typeof Badges>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    applicationLocale: "en",
  },
}
