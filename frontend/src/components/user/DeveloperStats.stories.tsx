import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"
import { UserInfoProvider } from "../../context/user-info"
import type { UserInfo } from "../../codegen"
import DeveloperStats from "./DeveloperStats"

const userInfo = {
  displayname: "Flathub Studio",
  dev_flatpaks: [
    "org.example.Editor",
    "org.example.Canvas",
    "org.example.Audio",
  ],
  permissions: [],
  owned_flatpaks: [],
  invited_flatpaks: [],
  invite_code: "abc-def-ghi",
  accepted_publisher_agreement_at: "2026-01-01T00:00:00Z",
  default_account: {
    login: "flathub-studio",
    avatar: "https://avatars.githubusercontent.com/u/1234567?v=4",
    provider: "github",
  },
  auths: {},
} satisfies UserInfo

const meta = {
  title: "Components/User/Developer stats",
  component: DeveloperStats,
  parameters: {
    layout: "padded",
    msw: {
      handlers: [
        http.get("*/auth/userinfo", () => HttpResponse.json(userInfo)),
        http.get("*/stats/:appId", ({ params }) => {
          const installs: Record<string, number> = {
            "org.example.Editor": 18240,
            "org.example.Canvas": 9360,
            "org.example.Audio": 2417,
          }
          const id = String(params.appId)
          return HttpResponse.json({
            id,
            installs_total: installs[id] * 24,
            installs_last_month: installs[id] * 4,
            installs_last_7_days: installs[id],
            installs_per_day: {},
            installs_per_country: {},
          })
        }),
      ],
    },
  },
} satisfies Meta<typeof DeveloperStats>

export default meta
type Story = StoryObj<typeof meta>

export const WeeklyDownloads: Story = {
  render: function Render() {
    const [queryClient] = useState(
      () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    )
    return (
      <QueryClientProvider client={queryClient}>
        <UserInfoProvider userContext={{ info: userInfo, loading: false }}>
          <div className="mx-auto max-w-4xl">
            <DeveloperStats />
          </div>
        </UserInfoProvider>
      </QueryClientProvider>
    )
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("30,017"),
    ).toBeInTheDocument()
  },
}

export const Dark: Story = {
  ...WeeklyDownloads,
  globals: { theme: "dark" },
}

export const StatsUnavailable: Story = {
  ...WeeklyDownloads,
  parameters: {
    msw: {
      handlers: [
        http.get("*/auth/userinfo", () => HttpResponse.json(userInfo)),
        http.get("*/stats/:appId", () =>
          HttpResponse.json({ detail: "Stats unavailable" }, { status: 503 }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(
        "Download totals are temporarily unavailable.",
      ),
    ).toBeInTheDocument()
  },
}
