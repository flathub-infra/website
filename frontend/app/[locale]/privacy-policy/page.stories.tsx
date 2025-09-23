import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import PrivacyPolicyClient from "./privacy-policy-client"

const meta = {
  component: PrivacyPolicyClient,
  title: "pages/privacy-policy",
} satisfies Meta<typeof PrivacyPolicyClient>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
