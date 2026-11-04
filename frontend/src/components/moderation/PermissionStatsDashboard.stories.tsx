import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { useState } from "react"
import PermissionStats from "./PermissionStats"
import PermissionStatsDashboard from "./PermissionStatsDashboard"
import { illustrativeWindow, octoberWindow } from "./permission-stats-fixtures"

const meta = {
  title: "Moderation/Permission statistics",
  component: PermissionStatsDashboard,
  parameters: { layout: "fullscreen" },
  args: { months: 6, onMonthsChange: fn(), onRetry: fn() },
} satisfies Meta<typeof PermissionStatsDashboard>
export default meta
type Story = StoryObj<typeof meta>

async function revealFilters(canvasElement: HTMLElement) {
  const button = within(canvasElement).queryByRole("button", {
    name: /^Filters/,
  })
  if (button) {
    await userEvent.click(button)
  }
}

export const ApiIntegration: Story = {
  render: function Render() {
    const [client] = useState(
      () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    )
    return (
      <QueryClientProvider client={client}>
        <PermissionStats />
      </QueryClientProvider>
    )
  },
  parameters: {
    msw: {
      handlers: [
        http.get("*/stats/permissions", ({ request }) =>
          HttpResponse.json({
            ...illustrativeWindow,
            start_month:
              new URL(request.url).searchParams.get("months") === "12"
                ? "2025-11"
                : "2026-05",
          }),
        ),
      ],
    },
    docs: {
      description: {
        story:
          "Uses a mocked API. Switching the period fetches a new history window.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("list", { name: "Permission counts" }),
    ).toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole("combobox", { name: "History period" }),
    )
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "12 months",
      }),
    )
    await expect(
      await canvas.findByRole("list", { name: "Permission counts" }),
    ).toBeInTheDocument()
  },
}

export const CurrentSnapshot: Story = { args: { window: octoberWindow } }
export const Light: Story = { ...CurrentSnapshot, globals: { theme: "light" } }
export const Dark: Story = { ...CurrentSnapshot, globals: { theme: "dark" } }
export const German: Story = { ...CurrentSnapshot, globals: { locale: "de" } }
export const IllustrativeMonthlyHistory: Story = {
  args: { window: illustrativeWindow },
  parameters: {
    docs: {
      description: {
        story:
          "Test data with a missing month, missing metadata, and a historical permission.",
      },
    },
  },
}
export const Loading: Story = { args: { isLoading: true } }
export const RequestError: Story = {
  args: { isError: true },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Retry" }),
    )
    await expect(args.onRetry).toHaveBeenCalled()
  },
}
export const NoSnapshots: Story = {
  args: { window: { ...octoberWindow, snapshots: [] } },
}
export const NoPermissionValues: Story = {
  args: {
    window: {
      ...octoberWindow,
      snapshots: [{ ...octoberWindow.snapshots[0], permission_counts: {} }],
    },
  },
}
export const ExplorerInteractions: Story = {
  args: { window: octoberWindow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await revealFilters(canvasElement)
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Filter by permission set" }),
    )
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Context / Filesystems",
      }),
    )
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Search permissions" }),
      "kdeglobals",
    )
    await expect(
      within(canvas.getByRole("list", { name: "Permission counts" })).getByText(
        "830",
        { exact: false },
      ),
    ).toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Sort permissions" }),
    )
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Name",
      }),
    )
    await userEvent.click(
      canvas.getByRole("button", { name: /xdg-config\/kdeglobals:ro/ }),
    )
    await expect(
      within(canvas.getByRole("region", { name: "Monthly history" })).getByText(
        "Not enough history",
      ),
    ).toBeInTheDocument()
  },
}

export const TrendInteractions: Story = {
  args: { window: illustrativeWindow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Search permissions" }),
      "network",
    )
    await userEvent.click(
      canvas.getByRole("button", { name: "View trend for network" }),
    )
    const trend = within(
      canvas.getByRole("region", { name: "Monthly history" }),
    )
    await expect(
      await trend.findByRole("img", { name: "Monthly app count for network" }),
    ).toBeInTheDocument()
    await userEvent.click(trend.getByRole("combobox", { name: "Measure" }))
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Share of eligible apps",
      }),
    )
    await expect(
      await trend.findByRole("img", {
        name: "Monthly recorded permission share for network",
      }),
    ).toBeInTheDocument()
    await expect(trend.getByText("0%", { exact: true })).toBeInTheDocument()
    await expect(trend.getByText("100%", { exact: true })).toBeInTheDocument()
    await userEvent.click(trend.getByText("Monthly data"))
    await expect(
      within(trend.getByRole("table", { name: "Monthly data" })).getByText(
        "No snapshot",
      ),
    ).toBeInTheDocument()
  },
}
export const HistoricalPermission: Story = {
  args: { window: illustrativeWindow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Search permissions" }),
      "/old-path",
    )
    await userEvent.click(canvas.getByRole("button", { name: /\/old-path/ }))
    await expect(canvas.getByText(/Historical only/)).toBeInTheDocument()
    await expect(
      canvas.getByRole("button", { name: /\/old-path/ }),
    ).toHaveAccessibleDescription(/Historical only/)
    await revealFilters(canvasElement)
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Current snapshot only" }),
    )
    await expect(
      canvas.getByText("No permissions match these filters."),
    ).toBeInTheDocument()
  },
}

export const InlineHistory: Story = {
  args: { window: illustrativeWindow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole("list", { name: "Permission counts" })
    await expect(within(list).getAllByRole("listitem")).toHaveLength(10)
    await expect(
      canvas.queryByRole("region", { name: "Monthly history" }),
    ).not.toBeInTheDocument()
    const row = canvas.getByRole("button", { name: "View trend for ipc" })
    await expect(row).toHaveAccessibleDescription(
      /Context \/ Shared.*Apps.*3,300.*Recorded share.*98.7%/,
    )
    await userEvent.click(row)
    await expect(row).toHaveAttribute("aria-expanded", "true")
    await expect(row).toHaveFocus()
    const chart = await canvas.findByRole("img", {
      name: "Monthly app count for ipc",
    })
    await expect(
      within(chart).getByText("0", { exact: true }),
    ).toBeInTheDocument()
    await expect(row.parentElement).toContainElement(
      canvas.getByRole("region", { name: "Monthly history" }),
    )
    await userEvent.keyboard("{Enter}")
    await expect(row).toHaveAttribute("aria-expanded", "false")
    await expect(
      canvas.queryByRole("region", { name: "Monthly history" }),
    ).not.toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole("button", { name: "Show more permissions" }),
    )
    await expect(within(list).getAllByRole("listitem")).toHaveLength(20)
  },
}
