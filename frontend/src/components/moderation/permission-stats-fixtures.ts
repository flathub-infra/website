import actualSnapshots from "./permission-stats-snapshot.json"
import type {
  PermissionStatsWindow,
  PermissionStatsSnapshot,
} from "./permission-stats"

// Full, supplied October 4 snapshot, including all 1,345 permission values.
export const octoberWindow: PermissionStatsWindow = {
  start_month: "2026-05",
  end_month: "2026-10",
  snapshots: actualSnapshots,
}

// Illustrative history only. These values are not production measurements.
const example = (
  date: string,
  network: number,
  home: number,
  covered: number,
): PermissionStatsSnapshot => ({
  snapshot_date: date,
  eligible_apps: 3344,
  apps_with_stable_metadata: covered,
  permission_counts: {
    context: {
      shared: { ipc: 3000, network },
      filesystems: {
        home,
        "host:ro": 49,
        ...(date === "2026-05-31" ? { "/old-path": 12 } : {}),
      },
    },
    "session-bus": { talk: { "org.freedesktop.secrets": 180 } },
  },
})
export const illustrativeWindow: PermissionStatsWindow = {
  start_month: "2026-05",
  end_month: "2026-10",
  snapshots: [
    example("2026-05-31", 1700, 530, 3200),
    example("2026-06-30", 1800, 520, 3200),
    example("2026-08-31", 1900, 500, 3100),
    example("2026-09-30", 1950, 490, 3300),
    actualSnapshots[0],
  ],
}
