import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import React from "react"

const meta = {
  title: "Components/UI/Select",
  component: Select,
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  render: function Render(args) {
    return (
      <Select defaultValue="test" onValueChange={(value) => {}}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="test">Test 1</SelectItem>
          <SelectItem value="test2">Test 2</SelectItem>
          <SelectItem value="test3">test 3</SelectItem>
        </SelectContent>
      </Select>
    )
  },
}

export const TitleWithDescription: Story = {
  args: {},
  render: function Render(args) {
    const [value, setValue] = React.useState<string>()

    return (
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[300px]">
          <SelectValue placeholder="Select a theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="notes"
            description={
              <span className="text-xs opacity-75">
                Find your new favorite note taking tool
              </span>
            }
          >
            Take Better Notes
          </SelectItem>
          <SelectItem
            value="tasks"
            description={
              <span className="text-xs opacity-75">
                Stay on top of every task
              </span>
            }
          >
            Get Things Done
          </SelectItem>
        </SelectContent>
      </Select>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole("combobox")

    await userEvent.click(trigger)
    await userEvent.click(
      page.getByRole("option", { name: "Take Better Notes" }),
    )

    await expect(trigger).toHaveTextContent("Take Better Notes")
    await expect(trigger).not.toHaveTextContent(
      "Find your new favorite note taking tool",
    )
  },
}
