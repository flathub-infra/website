import type { Meta, StoryObj } from "@storybook/nextjs"

import { TransactionHistoryTable } from "./TransactionHistoryTable"
import { TransactionSummary } from "../../../codegen/model"
import { faker } from "@faker-js/faker"

const meta = {
  component: TransactionHistoryTable,
  title: "Components/Payment/Transactions/TransactionHistoryTable",
} satisfies Meta<typeof TransactionHistoryTable>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    transactions: [
      {
        id: "1",
        kind: "donation",
        created: faker.date.recent().getTime() / 1000,
        status: "new",
        value: faker.number.int({ min: 100, max: 5000 }),
        currency: "USD",
      },
      {
        id: "2",
        kind: "purchase",
        created: faker.date.past().getTime() / 1000,
        status: "pending",
        value: faker.number.int({ min: 100, max: 5000 }),
        currency: "usd",
      },
      {
        id: "3",
        kind: "donation",
        created: faker.date.past().getTime() / 1000,
        status: "success",
        value: faker.number.int({ min: 100, max: 5000 }),
        currency: "USD",
      },
      {
        id: "4",
        kind: "donation",
        created: faker.date.past().getTime() / 1000,
        status: "cancelled",
        value: faker.number.int({ min: 100, max: 5000 }),
        currency: "USD",
      },
      {
        id: "5",
        kind: "donation",
        created: faker.date.past().getTime() / 1000,
        status: "retry",
        value: faker.number.int({ min: 100, max: 5000 }),
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
