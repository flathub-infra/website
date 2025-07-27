import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import Badge from "./Badge"
import React from "react"

const meta = {
  title: "Components/Badge",
  component: Badge,
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const TextOnly: Story = {
  args: {
    text: "Outdated",
  },
}

export const InACard: Story = {
  args: {
    text: "Outdated",
    inACard: true,
  },
  render: (args) => (
    <div className="rounded-xl bg-flathub-white p-4 pt-3 shadow-md dark:bg-flathub-arsenic">
      <Badge {...args} />
    </div>
  ),
}
