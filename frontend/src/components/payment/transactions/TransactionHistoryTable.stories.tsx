import type { Meta, StoryObj } from "@storybook/react"

import { TransactionHistoryTable } from "./TransactionHistoryTable"
import { TransactionSummary } from "../../../codegen/model"

const meta = {
  component: TransactionHistoryTable,
} satisfies Meta<typeof TransactionHistoryTable>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    transactions: [
      {
        id: "1",
        kind: "donation",
        created: 1612119840,
        status: "new",
        value: 1000,
        currency: "USD",
      },
      {
        id: "2",
        kind: "purchase",
        created: 1612119840,
        status: "pending",
        value: 2000,
        currency: "usd",
      },
      {
        id: "3",
        kind: "donation",
        created: 1612119840,
        status: "success",
        value: 3000,
        currency: "USD",
      },
      {
        id: "4",
        kind: "donation",
        created: 1612119840,
        status: "cancelled",
        value: 4000,
        currency: "USD",
      },
      {
        id: "5",
        kind: "donation",
        created: 1612119840,
        status: "retry",
        value: 5000,
        currency: "USD",
      },
    ] as TransactionSummary[],
    endPage: 1,
    page: 0,
    perPage: 10,
    setPage: () => {},
    error: "",
  },
}
