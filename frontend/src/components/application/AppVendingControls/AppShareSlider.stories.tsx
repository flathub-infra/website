import type { Meta, StoryObj } from "@storybook/react"

import AppShareSlider from "./AppShareSlider"

const meta = {
  component: AppShareSlider,
} satisfies Meta<typeof AppShareSlider>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 40,
    setValue: () => {},
  },
}
