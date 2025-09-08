import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import DonationInput from "./DonationInput"

const meta = {
  title: "Components/DonationInput",
  component: DonationInput,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof DonationInput>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    org: "Flathub",
  },
}
