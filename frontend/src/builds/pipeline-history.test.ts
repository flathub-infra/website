import { describe, expect, it } from "vitest"
import type { PipelineStatus, PipelineSummary } from "../codegen-pipeline"
import {
  buildDurationMinutes,
  hasSuccessfulBuildDuration,
  isSuccessfulBuild,
  summarizeSeries,
  toDurationSeries,
} from "./pipeline-history"

const base: PipelineSummary = {
  id: "1",
  app_id: "org.example.App",
  status: "published",
  triggered_by: "manual",
  created_at: "2026-01-01T00:00:00Z",
  started_at: "2026-01-01T00:00:00Z",
  finished_at: "2026-01-01T00:02:00Z",
}
const formatDate = (date: Date) => date.toISOString()

describe("successful build durations", () => {
  it("excludes incomplete and unsuccessful pipeline statuses", () => {
    const excluded: PipelineStatus[] = [
      "failed",
      "cancelled",
      "pending",
      "running",
      "publishing",
      "superseded",
    ]
    const included: PipelineStatus[] = ["succeeded", "committed", "published"]
    expect(excluded.every((status) => !isSuccessfulBuild(status))).toBe(true)
    expect(included.every(isSuccessfulBuild)).toBe(true)
    expect(
      toDurationSeries(
        excluded.map((status) => ({ ...base, status })),
        formatDate,
      ),
    ).toEqual([])
    expect(
      toDurationSeries(
        included.map((status) => ({ ...base, status })),
        formatDate,
      ).map((point) => point.status),
    ).toEqual(included)
  })

  it("omits missing bounds and recognizes a recorded zero-minute build", () => {
    expect(buildDurationMinutes({ ...base, started_at: null })).toBeNull()
    expect(buildDurationMinutes({ ...base, finished_at: null })).toBeNull()
    expect(
      hasSuccessfulBuildDuration([
        { ...base, started_at: null },
        { ...base, status: "failed" },
      ]),
    ).toBe(false)
    const short = { ...base, finished_at: "2026-01-01T00:00:20Z" }
    expect(buildDurationMinutes(short)).toBe(0)
    expect(hasSuccessfulBuildDuration([short])).toBe(true)
  })

  it("sorts points by start time and summarizes rounded minutes", () => {
    const short = {
      ...base,
      id: "short",
      started_at: "2026-01-01T00:00:00Z",
      finished_at: "2026-01-01T00:00:20Z",
    }
    const medium = {
      ...base,
      id: "medium",
      started_at: "2026-01-02T00:00:00Z",
      finished_at: "2026-01-02T00:02:00Z",
    }
    const long = {
      ...base,
      id: "long",
      started_at: "2026-01-03T00:00:00Z",
      finished_at: "2026-01-03T00:04:00Z",
    }
    const points = toDurationSeries([long, short, medium], formatDate)
    expect(
      points.map(({ durationMinutes, startedAt, date }) => [
        durationMinutes,
        startedAt,
        date,
      ]),
    ).toEqual([
      [0, short.started_at, new Date(short.started_at).toISOString()],
      [2, medium.started_at, new Date(medium.started_at).toISOString()],
      [4, long.started_at, new Date(long.started_at).toISOString()],
    ])
    expect(summarizeSeries(points)).toEqual({
      count: 3,
      averageMinutes: 2,
      minMinutes: 0,
      maxMinutes: 4,
    })
    expect(summarizeSeries([])).toEqual({
      count: 0,
      averageMinutes: 0,
      minMinutes: 0,
      maxMinutes: 0,
    })
  })
})
