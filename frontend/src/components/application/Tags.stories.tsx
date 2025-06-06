import type { Meta, StoryObj } from "@storybook/nextjs"

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
}
