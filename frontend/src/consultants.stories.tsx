import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import Consultants from "../pages/consultants"

const meta = {
  component: Consultants,
  title: "pages/consultants",
} satisfies Meta<typeof Consultants>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    locale: "en",
  },
}
