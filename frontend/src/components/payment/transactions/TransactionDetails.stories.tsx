import type { Meta, StoryObj } from "@storybook/nextjs"

import TransactionDetails from "./TransactionDetails"

const meta = {
  component: TransactionDetails,
  title: "Components/Payment/TransactionDetails",
} satisfies Meta<typeof TransactionDetails>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    transaction: {
      details: [
        {
          kind: "donation",
          recipient: "Flathub",
          amount: 100,
          currency: "USD",
        },
        {
          kind: "donation",
          recipient: "KDE",
          amount: 100,
          currency: "USD",
        },
      ],
      summary: {
        created: 1612119840,
        currency: "USD",
        id: "45",
        kind: "donation",
        reason: "payment",
        status: "success",
        updated: 1612119600,
        value: 200,
      },
      receipt: "15",
    },
  },
}

export const Failed: Story = {
  args: {
    transaction: {
      details: [
        {
          kind: "donation",
          recipient: "Flathub",
          amount: 100,
          currency: "USD",
        },
        {
          kind: "donation",
          recipient: "GNOME",
          amount: 100,
          currency: "USD",
        },
      ],
      summary: {
        created: 1612119840,
        currency: "USD",
        id: "45",
        kind: "donation",
        reason: "payment",
        status: "new",
        updated: 1612119600,
        value: 200,
      },
    },
  },
}
