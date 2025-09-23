import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import TermsAndConditionsClient from "./terms-and-conditions-client"

const meta = {
  component: TermsAndConditionsClient,
  title: "pages/terms-and-conditions",
} satisfies Meta<typeof TermsAndConditionsClient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
