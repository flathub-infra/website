import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import BadgesClient from "./badges-client"

const meta = {
  component: BadgesClient,
  title: "pages/badges",
} satisfies Meta<typeof BadgesClient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
