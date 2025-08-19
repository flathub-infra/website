import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import PrivacyPolicy from "../pages/privacy-policy"

const meta = {
  component: PrivacyPolicy,
  title: "pages/privacy-policy",
} satisfies Meta<typeof PrivacyPolicy>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    locale: "en",
  },
}
