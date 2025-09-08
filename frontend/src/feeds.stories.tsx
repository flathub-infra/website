import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import Feeds from "../pages/feeds"

const meta = {
  component: Feeds,
  title: "pages/feeds",
} satisfies Meta<typeof Feeds>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    locale: "en",
  },
}
