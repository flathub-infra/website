import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { Switch } from "./switch"
import { expect, within } from "storybook/test"
import { useArgs } from "storybook/preview-api"
import React from "react"

const meta = {
  title: "Components/UI/Switch",
  component: Switch,
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const Enabled: Story = {
  args: {
    checked: true,
    onCheckedChange: () => {},
  },
  render: function Render(args) {
    const [{ checked }, updateArgs] = useArgs()

    function onChange() {
      updateArgs({ checked: !checked })
    }

    return <Switch checked={checked} onCheckedChange={onChange} />
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const button = canvas.getByRole("switch")

    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute("data-state", "checked")
  },
}

export const Disabled: Story = {
  args: {
    checked: false,
    onCheckedChange: () => {},
  },
  render: function Render(args) {
    const [{ checked }, updateArgs] = useArgs()

    function onChange() {
      updateArgs({ checked: !checked })
    }

    return <Switch checked={checked} onCheckedChange={onChange} />
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const button = canvas.getByRole("switch")

    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute("data-state", "unchecked")
  },
}
