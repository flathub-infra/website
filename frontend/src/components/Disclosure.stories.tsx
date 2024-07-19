import type { Meta, StoryObj } from "@storybook/react"

import { FlathubDisclosure } from "./Disclosure"
import React from "react"

const meta: Meta<typeof FlathubDisclosure> = {
  component: FlathubDisclosure,
}

export default meta
type Story = StoryObj<typeof FlathubDisclosure>

export const Primary: Story = {
  args: {
    buttonItems: [<div key="button-1">Button 1</div>],
    children: [<div key="content-1">Content</div>],
  },
}
