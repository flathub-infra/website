import { describe, expect, it } from "vitest"
import {
  buildMonthlyPermissionTrend,
  buildPermissionInventory,
  flattenPermissionCounts,
  getPermissionPercentage,
} from "./permission-stats"

const snapshot = (date: string, permissions = {}, eligible = 10) => ({
  snapshot_date: date,
  eligible_apps: eligible,
  apps_with_stable_metadata: 8,
  permission_counts: permissions,
})

describe("permission inventory", () => {
  it("preserves full paths, duplicate names, and every filesystem value", () => {
    const counts = {
      context: {
        filesystems: Object.fromEntries(
          Array.from({ length: 674 }, (_, i) => [`path/${i}`, 1]),
        ),
        persistent: { home: 2 },
      },
      future: { custom: { home: 3 } },
    }
    const entries = flattenPermissionCounts(counts)
    expect(entries).toHaveLength(676)
    expect(
      entries.filter((x) => x.value === "home").map((x) => x.path),
    ).toEqual([
      ["context", "persistent", "home"],
      ["future", "custom", "home"],
    ])
  })
  it("keeps historical-only values with a current count of zero", () => {
    const entries = buildPermissionInventory([
      snapshot("2026-08-31", {
        context: { filesystems: { home: 4, host: 2 } },
      }),
      snapshot("2026-10-04", { context: { filesystems: { home: 3 } } }),
    ])
    expect(entries.find((x) => x.value === "host")).toMatchObject({
      count: 0,
      historicalOnly: true,
    })
    expect(entries.find((x) => x.value === "home")).toMatchObject({
      count: 3,
      historicalOnly: false,
    })
  })
})

describe("monthly trends", () => {
  it("separates missing-month gaps from observed zero and tracks coverage", () => {
    const points = buildMonthlyPermissionTrend(
      {
        start_month: "2026-08",
        end_month: "2026-10",
        snapshots: [
          snapshot("2026-10-04"),
          snapshot("2026-08-31", { context: { shared: { network: 6 } } }),
        ],
      },
      ["context", "shared", "network"],
    )
    expect(points.map((x) => x.count)).toEqual([6, null, 0])
    expect(points[0]).toMatchObject({
      percentage: 60,
      metadataCoverage: 80,
      snapshotDate: "2026-08-31",
    })
    expect(points[1].snapshotDate).toBeNull()
  })
  it("returns null percentages for zero eligible apps", () => {
    expect(getPermissionPercentage(0, 0)).toBeNull()
    expect(getPermissionPercentage(5, 10)).toBe(50)
  })
})
