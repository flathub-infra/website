import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import LanguagesClient from "./languages-client"

const meta = {
  component: LanguagesClient,
  title: "pages/languages",
} satisfies Meta<typeof LanguagesClient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
