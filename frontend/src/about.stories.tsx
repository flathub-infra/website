import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import About from "../pages/about"

const meta = {
  component: About,
  title: "pages/about",
} satisfies Meta<typeof About>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    locale: "en",
  },
}
