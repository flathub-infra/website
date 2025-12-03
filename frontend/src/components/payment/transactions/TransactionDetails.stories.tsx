import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import TransactionDetails from "./TransactionDetails"

const meta = {
  component: TransactionDetails,
  title: "Components/Payment/TransactionDetails",
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof TransactionDetails>

export default meta

type Story = StoryObj<typeof meta>

const baseTransaction = {
  details: [
    {
      kind: "donation" as const,
      recipient: "Flathub",
      amount: 100,
      currency: "USD",
    },
    {
      kind: "donation" as const,
      recipient: "KDE",
      amount: 100,
      currency: "USD",
    },
  ],
  receipt: "https://example.com/receipt",
}

export const Success: Story = {
  args: {
    transaction: {
      ...baseTransaction,
      summary: {
        created: 1612119840,
        currency: "USD",
        id: "45",
        kind: "donation",
        reason: "",
        status: "success",
        updated: 1612119600,
        value: 200,
      },
    },
  },
}

export const Pending: Story = {
  args: {
    transaction: {
      ...baseTransaction,
      summary: {
        created: 1612119840,
        currency: "USD",
        id: "46",
        kind: "donation",
        reason: "Payment processing",
        status: "pending",
        updated: 1612119600,
        value: 200,
      },
    },
  },
}

export const Cancelled: Story = {
  args: {
    transaction: {
      ...baseTransaction,
      summary: {
        created: 1612119840,
        currency: "USD",
        id: "47",
        kind: "donation",
        reason: "Cancelled by user",
        status: "cancelled",
        updated: 1612119600,
        value: 200,
      },
    },
  },
}

export const New: Story = {
  args: {
    transaction: {
      ...baseTransaction,
      summary: {
        created: 1612119840,
        currency: "USD",
        id: "48",
        kind: "donation",
        reason: "Awaiting payment",
        status: "new",
        updated: 1612119600,
        value: 200,
      },
    },
  },
}

export const Retry: Story = {
  args: {
    transaction: {
      ...baseTransaction,
      summary: {
        created: 1612119840,
        currency: "USD",
        id: "49",
        kind: "donation",
        reason: "Payment failed, retry required",
        status: "retry",
        updated: 1612119600,
        value: 200,
      },
    },
  },
}
