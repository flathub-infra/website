import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import PermissionStatsTrend from "./PermissionStatsTrend"
import type { PermissionEntry, PermissionStatsWindow } from "./permission-stats"

const meta = {
  title: "Components/Moderation/PermissionStatsTrend",
  component: PermissionStatsTrend,
  parameters: {
    nextjs: { appDirectory: true },
  },
} satisfies Meta<typeof PermissionStatsTrend>

export default meta
type Story = StoryObj<typeof meta>

const window: PermissionStatsWindow = {
  start_month: "2025-01",
  end_month: "2025-06",
  snapshots: [
    { month: "2025-01", date: "2025-01-31", count: 82, metadata: 94 },
    { month: "2025-02", date: "2025-02-28", count: 89, metadata: 95 },
    { month: "2025-03", date: "2025-03-31", count: 96, metadata: 94 },
    { month: "2025-04", date: "2025-04-30", count: 108, metadata: 96 },
    { month: "2025-05", date: "2025-05-31", count: 119, metadata: 95 },
    { month: "2025-06", date: "2025-06-30", count: 134, metadata: 97 },
  ].map(({ month, date, count, metadata }) => ({
    snapshot_date: date,
    eligible_apps: 1_000,
    apps_with_stable_metadata: metadata * 10,
    permission_counts: {
      "session-bus": {
        talk: { "org.example.App": count },
      },
    },
  })),
}

const entry: PermissionEntry = {
  path: ["session-bus", "talk", "org.example.App"],
  groupPath: ["session-bus", "talk"],
  value: "org.example.App",
  count: 134,
  historicalOnly: false,
}

export const Default: Story = {
  args: { window, entry },
}

export const NoPermissionSelected: Story = {
  args: { window },
}

export const InsufficientHistory: Story = {
  args: { window: { ...window, snapshots: window.snapshots.slice(-1) }, entry },
}
