import type { Meta, StoryObj } from "@storybook/nextjs"

import TokenRedeemDialog from "./TokenRedeemDialog"

const meta = {
  title:
    "Components/Application/AppVendingControls/OwnershipTokens/TokenRedeemDialog",
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
