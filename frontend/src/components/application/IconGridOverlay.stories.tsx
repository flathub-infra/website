import type { Meta, StoryObj } from "@storybook/nextjs"

import { IconGridOverlay } from "./IconGridOverlay"

const meta = {
  component: IconGridOverlay,
  title: "Components/Application/IconGridOverlay",
} satisfies Meta<typeof IconGridOverlay>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
