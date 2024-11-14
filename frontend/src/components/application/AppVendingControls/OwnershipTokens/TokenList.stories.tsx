import type { Meta, StoryObj } from "@storybook/react"

import TokenList from "./TokenList"

import { getVendingMock } from "../../../../codegen/vending/vending.msw"

const meta = {
  component: TokenList,
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
