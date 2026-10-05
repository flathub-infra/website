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
          "The real query component, using a mocked API with illustrative monthly data. Switch between six and twelve months to exercise data fetching.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("Permission values in this period"),
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
      await canvas.findByText("Permission values in this period"),
    ).toBeInTheDocument()
  },
}

export const CurrentSnapshot: Story = { args: { window: octoberWindow } }
export const Light: Story = { ...CurrentSnapshot, globals: { theme: "light" } }
export const Dark: Story = { ...CurrentSnapshot, globals: { theme: "dark" } }
export const IllustrativeMonthlyHistory: Story = {
  args: { window: illustrativeWindow },
  parameters: {
    docs: {
      description: {
        story:
          "Illustrative history, not production measurements. Includes a missing July, reduced metadata coverage, and a historical-only permission.",
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
    await userEvent.click(
      canvas.getByRole("button", { name: /^Context \/ Filesystems/ }),
    )
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Search permissions" }),
      "kdeglobals",
    )
    await expect(canvas.getByText("830", { exact: true })).toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Sort permissions" }),
    )
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("option", {
        name: "Name A–Z",
      }),
    )
    await expect(
      await canvas.findByRole("columnheader", { name: "Permission" }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("columnheader", { name: "Apps" }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("columnheader", { name: "Recorded share" }),
    ).toBeInTheDocument()
    await userEvent.click(
      canvas.getByRole("button", { name: /xdg-config\/kdeglobals:ro/ }),
    )
    await expect(
      within(
        canvas.getByRole("region", { name: "Monthly adoption trend" }),
      ).getByText("xdg-config/kdeglobals:ro"),
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
      canvas.getByRole("region", { name: "Monthly adoption trend" }),
    )
    await expect(
      trend.getByText("network", { exact: true }),
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
    await userEvent.click(
      trend.getByText("Snapshot dates and metadata coverage"),
    )
    await expect(
      within(
        trend.getByRole("table", { name: "Monthly observations" }),
      ).getByText("No snapshot"),
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
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Current snapshot only" }),
    )
    await expect(
      canvas.getByText("No permissions match these filters."),
    ).toBeInTheDocument()
  },
}
