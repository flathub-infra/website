import type { Meta, StoryObj } from "@storybook/react"

import TokenRedeemDialog from "./TokenRedeemDialog"

const meta = {
  component: TokenRedeemDialog,
} satisfies Meta<typeof TokenRedeemDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    app: {
      id: "tv.abc.TestApp",
    },
  },
}
