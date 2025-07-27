import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { FlathubDisclosure } from "./Disclosure"
import React from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"

const meta: Meta<typeof FlathubDisclosure> = {
  title: "Components/Disclosure",
  component: FlathubDisclosure,
}

export default meta
type Story = StoryObj<typeof FlathubDisclosure>

export const Default: Story = {
  args: {
    buttonItems: [<div key="button-1">Button 1</div>],
    children: [<div key="content-1">Content</div>],
  },
}

export const Opened: Story = {
  args: {
    buttonItems: [<div key="button-1">Button 1</div>],
    children: [<div key="content-1">Content</div>],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button"))

    await waitFor(() => {
      expect(canvas.getByText("Content")).toBeInTheDocument()
    })
  },
}
