import type { Meta, StoryObj } from "@storybook/react"

import TokenCancelButton from "./TokenCancelButton"

const meta = {
  component: TokenCancelButton,
} satisfies Meta<typeof TokenCancelButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    appId: "tv.kodi.Kodi",
    setState: () => {},
    token: {
      id: "1",
    },
  },
}
