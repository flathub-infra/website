import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import AboutClient from "./about-client"

const meta = {
  component: AboutClient,
  title: "pages/about",
} satisfies Meta<typeof AboutClient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
