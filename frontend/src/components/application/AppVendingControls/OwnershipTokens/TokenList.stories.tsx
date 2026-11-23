import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { UserContext } from "src/context/user-info"
import type { UserState } from "src/types/Login"
import { expect } from "storybook/test"

import TokenList from "./TokenList"

import {
  getVendingMock,
  getGetRedeemableTokensVendingappAppIdTokensGetMockHandler,
} from "../../../../codegen/vending/vending.msw"

const user = {
  loading: false,
  info: {
    invite_code: "storybook-token-manager",
    default_account: { login: "token-manager", provider: "github" },
    auths: {},
    accepted_publisher_agreement_at: null,
  },
} satisfies UserState

function TokenListStoryProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <UserContext value={user}>
      <QueryClientProvider client={queryClient}>
        <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
          {children}
        </div>
      </QueryClientProvider>
    </UserContext>
  )
}

const meta = {
  args: { app: { id: "tv.abc.TestApp" }, canManage: true },
  component: TokenList,
  title: "Components/Application/AppVendingControls/OwnershipTokens/TokenList",
  decorators: [
    (Story, { id }) => (
      <TokenListStoryProviders key={id}>
        <Story />
      </TokenListStoryProviders>
    ),
  ],
} satisfies Meta<typeof TokenList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Test Token 1")).toBeVisible()
  },
  parameters: {
    msw: {
      handlers: [
        getGetRedeemableTokensVendingappAppIdTokensGetMockHandler({
          status: "success",
          tokens: [
            {
              id: "token-1",
              state: "unredeemed",
              name: "Test Token 1",
              token: "ABCD-EFGH-IJKL",
              created: "2024-01-01T00:00:00Z",
              changed: "2024-01-01T00:00:00Z",
            },
            {
              id: "token-2",
              state: "redeemed",
              name: "Test Token 2",
              token: undefined,
              created: "2024-01-02T00:00:00Z",
              changed: "2024-01-02T00:00:00Z",
            },
          ],
          pagination: {
            page: 1,
            page_size: 10,
            total: 2,
            total_pages: 1,
          },
        }),
        ...getVendingMock(),
      ],
    },
  },
}

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("button", { name: "Create tokens" }),
    ).toBeVisible()
    await expect(canvas.getAllByRole("button")).toHaveLength(1)
  },
  parameters: {
    msw: {
      handlers: [
        getGetRedeemableTokensVendingappAppIdTokensGetMockHandler({
          status: "success",
          tokens: [],
          pagination: {
            page: 1,
            page_size: 10,
            total: 0,
            total_pages: 0,
          },
        }),
        ...getVendingMock(),
      ],
    },
  },
}

export const WithPagination: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("navigation", { name: "pagination" }),
    ).toBeVisible()
  },
  parameters: {
    nextjs: { appDirectory: true },
    msw: {
      handlers: [
        getGetRedeemableTokensVendingappAppIdTokensGetMockHandler({
          status: "success",
          tokens: Array.from({ length: 10 }, (_, i) => ({
            id: `token-${i + 1}`,
            state:
              i % 3 === 0
                ? "unredeemed"
                : i % 3 === 1
                  ? "redeemed"
                  : "cancelled",
            name: `Token ${i + 1}`,
            token: i % 3 === 0 ? `ABCD-EFGH-${i}` : undefined,
            created: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
            changed: `2024-01-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
          })),
          pagination: {
            page: 1,
            page_size: 10,
            total: 35,
            total_pages: 4,
          },
        }),
        ...getVendingMock(),
      ],
    },
  },
}

export const MixedStates: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Cancelled Token")).toBeVisible()
  },
  parameters: {
    msw: {
      handlers: [
        getGetRedeemableTokensVendingappAppIdTokensGetMockHandler({
          status: "success",
          tokens: [
            {
              id: "token-1",
              state: "unredeemed",
              name: "Unredeemed Token",
              token: "XXXX-YYYY-ZZZZ",
              created: "2024-01-01T00:00:00Z",
              changed: "2024-01-01T00:00:00Z",
            },
            {
              id: "token-2",
              state: "redeemed",
              name: "Redeemed Token",
              token: undefined,
              created: "2024-01-02T00:00:00Z",
              changed: "2024-01-03T08:30:00Z",
            },
            {
              id: "token-3",
              state: "cancelled",
              name: "Cancelled Token",
              token: undefined,
              created: "2024-01-04T00:00:00Z",
              changed: "2024-01-05T14:15:00Z",
            },
            {
              id: "token-4",
              state: "unredeemed",
              name: "Another Available Token",
              token: "AAAA-BBBB-CCCC",
              created: "2024-01-06T00:00:00Z",
              changed: "2024-01-06T00:00:00Z",
            },
          ],
          pagination: {
            page: 1,
            page_size: 10,
            total: 4,
            total_pages: 1,
          },
        }),
        ...getVendingMock(),
      ],
    },
  },
}
