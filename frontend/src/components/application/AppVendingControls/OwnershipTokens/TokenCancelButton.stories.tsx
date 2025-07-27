import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import TokenCancelButton from "./TokenCancelButton"

const meta = {
  component: TokenCancelButton,
  title:
    "Components/Application/AppVendingControls/OwnershipTokens/TokenCancelButton",
} satisfies Meta<typeof TokenCancelButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    appId: "tv.kodi.Kodi",
    setState: () => {},
    token: {
      token: "1",
    },
  },
}
