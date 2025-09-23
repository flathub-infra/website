import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import FeedsClient from "./feeds-client"

const meta = {
  component: FeedsClient,
  title: "pages/feeds",
} satisfies Meta<typeof FeedsClient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
