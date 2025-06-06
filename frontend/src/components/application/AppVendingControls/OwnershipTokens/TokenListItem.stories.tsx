import type { Meta, StoryObj } from "@storybook/nextjs"

import TokenListItem from "./TokenListItem"
import { faker } from "@faker-js/faker"
import { Disclosure } from "@headlessui/react"
import React from "react"

const meta = {
  component: TokenListItem,
  title:
    "Components/Application/AppVendingControls/OwnershipTokens/TokenListItem",
} satisfies Meta<typeof TokenListItem>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    appId: "tv.kodi.Kodi",
    open: false,
    token: {
      id: "1",
      changed: faker.date.recent().toISOString(),
      created: faker.date.past().toISOString(),
      name: "Token 1",
      state: "unredeemed",
      token: "165165",
    },
  },
  render: (args) => (
    <Disclosure defaultOpen>
      {({ open }) => <TokenListItem {...args} open={open} />}
    </Disclosure>
  ),
}
