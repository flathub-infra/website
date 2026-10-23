import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import withMockAppRouter from "../../../.storybook/withMockAppRouter"

import DonationInput from "./DonationInput"

const meta = {
  title: "Components/DonationInput",
  component: DonationInput,
  decorators: [withMockAppRouter],
} satisfies Meta<typeof DonationInput>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    org: "Flathub",
  },
}
