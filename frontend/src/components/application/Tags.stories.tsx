import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

import Tags from "./Tags"

const meta = {
  component: Tags,
  title: "Components/Application/Tags",
} satisfies Meta<typeof Tags>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    keywords: ["tag1", "tag2", "tag3"],
  },
  play: async ({ canvas }) => {
    const tag = canvas.getByRole("link", { name: "tag1" })
    const height = tag.getBoundingClientRect().height
    const compact = window.matchMedia(
      "(min-width: 40rem) and (not (any-pointer: coarse))",
    ).matches

    if (compact) {
      await expect(height).toBeGreaterThanOrEqual(24)
      await expect(height).toBeLessThan(44)
    } else {
      await expect(height).toBeGreaterThanOrEqual(44)
    }
  },
}
