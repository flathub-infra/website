import type {
  PermissionStatsSnapshotResult,
  PermissionStatsWindowResult,
} from "src/codegen/model"

export type PermissionStatsSnapshot = PermissionStatsSnapshotResult
export type PermissionStatsWindow = PermissionStatsWindowResult
export interface PermissionEntry {
  path: string[]
  groupPath: string[]
  value: string
  count: number
  historicalOnly: boolean
}
export interface PermissionTrendPoint {
  month: string
  snapshotDate: string | null
  count: number | null
  eligibleApps: number | null
  percentage: number | null
  metadataCoverage: number | null
}

export const permissionKey = (path: string[]) => JSON.stringify(path)

export function flattenPermissionCounts(
  counts: Record<string, unknown>,
): PermissionEntry[] {
  const entries: PermissionEntry[] = []
  function walk(node: Record<string, unknown>, path: string[]) {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "number" && Number.isInteger(value)) {
        entries.push({
          path: [...path, key],
          groupPath: path,
          value: key,
          count: value,
          historicalOnly: false,
        })
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, [...path, key])
      }
    }
  }
  walk(counts, [])
  return entries
}

export function buildPermissionInventory(
  snapshots: PermissionStatsSnapshot[],
): PermissionEntry[] {
  const sorted = [...snapshots].sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date),
  )
  const union = new Map<string, PermissionEntry>()
  for (const snapshot of sorted) {
    for (const entry of flattenPermissionCounts(snapshot.permission_counts)) {
      union.set(permissionKey(entry.path), {
        ...entry,
        count: 0,
        historicalOnly: true,
      })
    }
  }
  const latest = sorted.at(-1)
  if (latest) {
    for (const entry of flattenPermissionCounts(latest.permission_counts))
      union.set(permissionKey(entry.path), entry)
  }
  return [...union.values()]
}

export function getPermissionPercentage(
  count: number,
  eligibleApps: number,
): number | null {
  return eligibleApps > 0 ? (count / eligibleApps) * 100 : null
}

export function buildMonthlyPermissionTrend(
  window: PermissionStatsWindow,
  entryPath: string[],
): PermissionTrendPoint[] {
  const snapshots = new Map(
    window.snapshots.map((snapshot) => [
      snapshot.snapshot_date.slice(0, 7),
      snapshot,
    ]),
  )
  const points: PermissionTrendPoint[] = []
  const [year, month] = window.start_month.split("-").map(Number)
  let date = new Date(Date.UTC(year, month - 1, 1))
  for (let i = 0; i < 12; i++) {
    const key = date.toISOString().slice(0, 7)
    if (key > window.end_month) break
    const snapshot = snapshots.get(key)
    let node: unknown = snapshot?.permission_counts
    for (const segment of entryPath) {
      node =
        node && typeof node === "object" && Object.hasOwn(node, segment)
          ? (node as Record<string, unknown>)[segment]
          : undefined
    }
    const count = snapshot ? (typeof node === "number" ? node : 0) : null
    points.push({
      month: key,
      snapshotDate: snapshot?.snapshot_date ?? null,
      count,
      eligibleApps: snapshot?.eligible_apps ?? null,
      percentage:
        snapshot && count !== null
          ? getPermissionPercentage(count, snapshot.eligible_apps)
          : null,
      metadataCoverage: snapshot
        ? getPermissionPercentage(
            snapshot.apps_with_stable_metadata,
            snapshot.eligible_apps,
          )
        : null,
    })
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  }
  return points
}

export function permissionGroupLabel(path: string[]): string {
  return path
    .map(
      (segment) =>
        ({
          context: "Context",
          "system-bus": "System bus",
          "session-bus": "Session bus",
          "unset-environment": "Unset environment",
        })[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join(" / ")
}
