import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"
import { ApplicationCard } from "../application/ApplicationCard"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import DeveloperStats from "./DeveloperStats"

const applications = [
  {
    id: "org.example.Editor",
    name: "Fieldnotes",
    summary: "A focused writing space for ideas, drafts, and daily notes.",
    icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
  },
  {
    id: "org.example.Canvas",
    name: "Contour",
    summary: "A friendly vector studio for illustrations and diagrams.",
    icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
  },
  {
    id: "org.example.Audio",
    name: "Tern",
    summary: "A compact audio workstation for making loops and sketches.",
    icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
  },
]

const meta = {
  title: "Components/User/Developer app stats",
  parameters: {
    layout: "padded",
    msw: {
      handlers: [
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
            installs_last_month: installs[id],
            installs_last_7_days: Math.round(installs[id] / 4),
            installs_per_day: {},
            installs_per_country: {},
          })
        }),
      ],
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function AppCards({ single = false }: { single?: boolean }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(single ? applications.slice(0, 1) : applications).map(
          (application) => (
            <Card
              key={application.id}
              className="gap-0 overflow-hidden rounded-lg bg-flathub-gainsborow/40 p-0 shadow-md dark:bg-flathub-gainsborow/10"
            >
              <CardContent className="p-0">
                <ApplicationCard application={application} variant="nested" />
              </CardContent>
              <CardFooter className="justify-end border-t border-flathub-gainsborow/80 px-1 py-0 dark:border-flathub-granite-gray/30 [.border-t]:pt-0">
                <DeveloperStats application={application} />
              </CardFooter>
            </Card>
          ),
        )}
      </div>
    </QueryClientProvider>
  )
}

export const MonthlyDownloads: Story = {
  render: () => <AppCards />,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("18,240"),
    ).toBeInTheDocument()
    await expect(
      within(canvasElement).getAllByText("Downloads last month"),
    ).toHaveLength(3)
  },
}

export const SingleApp: Story = {
  render: () => <AppCards single />,
}

export const Dark: Story = {
  ...MonthlyDownloads,
  globals: { theme: "dark" },
}

export const StatsUnavailable: Story = {
  ...MonthlyDownloads,
  parameters: {
    msw: {
      handlers: [
        http.get("*/stats/:appId", () =>
          HttpResponse.json({ detail: "Stats unavailable" }, { status: 503 }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findAllByText(
        "Download totals are temporarily unavailable.",
      ),
    ).toHaveLength(3)
  },
}
