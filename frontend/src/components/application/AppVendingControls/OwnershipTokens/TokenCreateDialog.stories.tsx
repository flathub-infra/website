import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import TokenCreateDialog from "./TokenCreateDialog"
import { expect, userEvent, waitFor, within } from "storybook/test"
import React from "react"

const meta = {
  title:
    "Components/Application/AppVendingControls/OwnershipTokens/TokenCreateDialog",
  component: TokenCreateDialog,
} satisfies Meta<typeof TokenCreateDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ height: "900px" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    app: {
      id: "tv.abc.TestApp",
    },
    updateCallback: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const button = canvas.getByRole("button")

    await userEvent.click(button)

    await waitFor(() => {
      expect(canvas.getByText("Create tokens")).toBeInTheDocument()
    })
  },
}
