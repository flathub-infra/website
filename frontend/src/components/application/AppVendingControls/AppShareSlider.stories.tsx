import type { Meta, StoryObj } from "@storybook/nextjs"

import AppShareSlider from "./AppShareSlider"

const meta = {
  title: "Components/Application/AppVendingControls/AppShareSlider",
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
