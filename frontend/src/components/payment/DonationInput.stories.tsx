import type { Meta, StoryObj } from "@storybook/react"

import DonationInput from "./DonationInput"

const meta = {
  title: "Components/DonationInput",
  component: DonationInput,
} satisfies Meta<typeof DonationInput>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    org: "Flathub",
  },
}
