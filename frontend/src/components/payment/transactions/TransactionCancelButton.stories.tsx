import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import TransactionCancelButton from "./TransactionCancelButton"

const meta = {
  component: TransactionCancelButton,
  title: "Components/Payment/TransactionCancelButton",
} satisfies Meta<typeof TransactionCancelButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    id: "123",
  },
}
