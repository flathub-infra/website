import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import TermsAndConditions from "../pages/terms-and-conditions"

const meta = {
  component: TermsAndConditions,
  title: "pages/terms-and-conditions",
} satisfies Meta<typeof TermsAndConditions>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    locale: "en",
  },
}
