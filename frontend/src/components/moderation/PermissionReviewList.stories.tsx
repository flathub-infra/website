import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { getRouter } from "@storybook/nextjs-vite/navigation.mock"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { delay, http, HttpResponse } from "msw"
import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"
import PermissionReviewList from "./PermissionReviewList"

const apps = [
  "com.warlordsoftwares.formatlab",
  "dk.pracedru.Symbolical",
  "com.warlordsoftwares.wallpaper-app-4kwall",
  "net.peercoin.peercoin-qt",
  "io.github.cudatext.CudaText-Qt",
  "ro.go.hmlendea.SokoGrump",
  "io.gitlab.ilshat.apps.manuscript",
  "tech.dongdongbh.mindwtr",
  "com.cherry_ai.CherryStudio",
  "io.github.neil_morrison44.pocket-sync",
  "ee.ria.qdigidoc4",
  "org.gnunhealth.mygnuhealth",
]

const outcomes = [
  "accepted",
  "pending",
  "accepted",
  "rejected",
  "error",
  "pending",
]
const items = Array.from({ length: 126 }, (_, i) => ({
  assessment_id: 4307 - i,
  app_id: apps[i % apps.length],
  pull_request_url: `https://github.com/flathub/${apps[i % apps.length]}/pull/${52 + i}`,
  pull_request_number: 52 + i,
  target_git_branch: i % 7 === 6 ? "beta" : "master",
  destination_channel: i % 7 === 6 ? "beta" : "stable",
  flatpak_branch: i % 7 === 6 ? "beta" : "stable",
  outcome: outcomes[i % outcomes.length],
  superseded_by: i % 11 === 10 ? 4308 - i : null,
}))

const listHandler = (paginated = false) =>
  http.get("*/moderation/permission-reviews", ({ request }) => {
    const params = new URL(request.url).searchParams
    const outcome = params.get("outcome")
    const filtered = (paginated ? items : items.slice(0, 12)).filter(
      (item) =>
        (outcome === "all" || item.outcome === outcome) &&
        (params.get("include_superseded") === "true" ||
          item.superseded_by === null),
    )
    const offset = Number(params.get("offset") ?? 0)
    return HttpResponse.json({
      items: filtered.slice(offset, offset + 50),
      total: filtered.length,
    })
  })

const meta = {
  title: "Moderation/Permission review list",
  component: PermissionReviewList,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/en/admin/moderation/permissions",
        query: { outcome: "all" },
      },
    },
    msw: { handlers: [listHandler()] },
    docs: {
      description: {
        component:
          "Illustrative assessments for checking review-list layout, filtering, pagination, and theme contrast; not production data.",
      },
    },
  },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      return (
        <QueryClientProvider client={client}>
          <div className="min-h-screen bg-flathub-lotion dark:bg-flathub-dark-gunmetal">
            <div className="mx-auto max-w-7xl px-4 sm:px-8">
              <Story />
            </div>
          </div>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof PermissionReviewList>
export default meta
type Story = StoryObj<typeof meta>

export const Light: Story = { globals: { theme: "light" } }
export const Dark: Story = { globals: { theme: "dark" } }
export const Paginated: Story = {
  parameters: { msw: { handlers: [listHandler(true)] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("navigation", { name: "pagination" }),
    ).toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "2" })).toHaveAttribute(
      "href",
      expect.stringContaining("page=2"),
    )
    await expect(canvas.getByRole("link", { name: "2" })).toHaveAttribute(
      "href",
      expect.stringContaining("outcome=all"),
    )
  },
}
export const Filters: Story = {
  parameters: {
    nextjs: {
      navigation: {
        query: { outcome: "all", page: "2", includeSuperseded: "true" },
      },
    },
    msw: { handlers: [listHandler(true)] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Include superseded assessments" }),
    )
    await expect(getRouter().push.mock.calls.at(-1)?.[0]).not.toContain(
      "includeSuperseded",
    )
    await expect(getRouter().push.mock.calls.at(-1)?.[0]).toContain("page=1")

    await canvas.findByRole("table")
    await userEvent.click(canvas.getByRole("combobox", { name: "Outcome" }))
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "accepted",
      }),
    )
    const destination = getRouter().push.mock.calls.at(-1)?.[0]
    await expect(destination).toContain("outcome=accepted")
    await expect(destination).toContain("page=1")
    await expect(destination).toContain("includeSuperseded=true")
  },
}
export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/permission-reviews", () =>
          HttpResponse.json({ items: [], total: 0 }),
        ),
      ],
    },
  },
}
export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/permission-reviews", async () => {
          await delay("infinite")
          return HttpResponse.json({ items: [], total: 0 })
        }),
      ],
    },
  },
}
export const RequestError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(
          "*/moderation/permission-reviews",
          () => new HttpResponse(null, { status: 503 }),
        ),
      ],
    },
  },
}
