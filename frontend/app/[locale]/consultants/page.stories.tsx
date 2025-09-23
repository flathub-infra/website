import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import ConsultantsClient from "./consultants-client"

const meta = {
  component: ConsultantsClient,
  title: "pages/consultants",
} satisfies Meta<typeof ConsultantsClient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
