import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import TokenList from "./TokenList"

import {
  getVendingMock,
  getGetRedeemableTokensVendingappAppIdTokensGetMockHandler,
} from "../../../../codegen/vending/vending.msw"

const meta = {
  component: TokenList,
  title: "Components/Application/AppVendingControls/OwnershipTokens/TokenList",
} satisfies Meta<typeof TokenList>

export default meta

type Story = StoryObj<typeof meta>

const decorator = [
  (Story: React.ComponentType) => (
    <div className="p-4 rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
      <Story />
    </div>
  ),
]

export const Default: Story = {
  args: {
    app: { id: "tv.abc.TestApp" },
  },
  decorators: decorator,
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
  args: {
    app: { id: "tv.abc.TestApp" },
  },
  decorators: decorator,
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
  args: {
    app: { id: "tv.abc.TestApp" },
  },
  decorators: decorator,
  parameters: {
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
  args: {
    app: { id: "tv.abc.TestApp" },
  },
  decorators: decorator,
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
