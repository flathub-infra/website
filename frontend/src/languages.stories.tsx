import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import Languages from "../pages/languages"

const meta = {
  component: Languages,
  title: "pages/languages",
} satisfies Meta<typeof Languages>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    locale: "en",
  },
}
