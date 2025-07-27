import type { Meta, StoryObj } from "@storybook/nextjs-vite"

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
