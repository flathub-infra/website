import type { Meta, StoryObj } from "@storybook/nextjs"

import CurrencyInput from "./CurrencyInput"

const meta = {
  title: "Components/CurrencyInput",
  component: CurrencyInput,
} satisfies Meta<typeof CurrencyInput>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    setValue: () => {},
    maximum: 100,
    inputValue: {
      live: 0,
      settled: 0,
    },
  },
}
