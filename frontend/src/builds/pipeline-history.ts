import { UTCDate } from "@date-fns/utc"
import type { PipelineStatus, PipelineSummary } from "src/codegen-pipeline"

export const SUCCESSFUL_BUILD_STATUSES = [
  "succeeded",
  "committed",
  "published",
] as const

export function isSuccessfulBuild(status: PipelineStatus): boolean {
  return SUCCESSFUL_BUILD_STATUSES.some((successful) => successful === status)
}

export function buildDurationMinutes(build: PipelineSummary): number | null {
  if (!build.started_at || !build.finished_at) return null
  return Math.max(
    0,
    Math.round(
      (new UTCDate(build.finished_at).getTime() -
        new UTCDate(build.started_at).getTime()) /
        60000,
    ),
  )
}

export interface BuildDurationPoint {
  startedAt: string
  date: string
  durationMinutes: number
  status: PipelineStatus
}

export function toDurationSeries(
  builds: PipelineSummary[],
  formatDate: (startedAt: Date) => string,
): BuildDurationPoint[] {
  const points: BuildDurationPoint[] = []
  for (const build of builds) {
    if (!isSuccessfulBuild(build.status)) continue
    const durationMinutes = buildDurationMinutes(build)
    if (durationMinutes === null) continue
    points.push({
      startedAt: build.started_at!,
      date: formatDate(new UTCDate(build.started_at!)),
      durationMinutes,
      status: build.status,
    })
  }
  return points.sort(
    (a, b) =>
      new UTCDate(a.startedAt).getTime() - new UTCDate(b.startedAt).getTime(),
  )
}

export function summarizeSeries(points: BuildDurationPoint[]): {
  count: number
  averageMinutes: number
  maxMinutes: number
  minMinutes: number
} {
  if (points.length === 0)
    return { count: 0, averageMinutes: 0, maxMinutes: 0, minMinutes: 0 }
  let sum = 0
  let maxMinutes = -Infinity
  let minMinutes = Infinity
  for (const { durationMinutes } of points) {
    sum += durationMinutes
    maxMinutes = Math.max(maxMinutes, durationMinutes)
    minMinutes = Math.min(minMinutes, durationMinutes)
  }
  return {
    count: points.length,
    averageMinutes: sum / points.length,
    maxMinutes,
    minMinutes,
  }
}

export function hasSuccessfulBuildDuration(builds: PipelineSummary[]): boolean {
  return builds.some(
    (build) =>
      isSuccessfulBuild(build.status) && buildDurationMinutes(build) !== null,
  )
}
