import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import TokenList from "./TokenList"

import { getVendingMock } from "../../../../codegen/vending/vending.msw"

const meta = {
  component: TokenList,
  title: "Components/Application/AppVendingControls/OwnershipTokens/TokenList",
} satisfies Meta<typeof TokenList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    app: { id: "tv.abc.TestApp" },
  },
  parameters: {
    msw: {
      handlers: [...getVendingMock()],
    },
  },
}
