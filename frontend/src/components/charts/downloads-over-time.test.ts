import { createChartScene } from "@tanstack/charts"
import { describe, expect, it } from "vitest"
import {
  aggregateDownloadsByMonth,
  createDownloadsOverTimeChart,
  formatMonthTick,
  formatMonthTooltip,
} from "./downloads-over-time"

describe("downloads over time aggregation", () => {
  it("aggregates daily downloads into monthly totals and discards the latest incomplete day", () => {
    const raw = {
      "2023-12-30": 100,
      "2023-12-31": 150,
      "2024-01-01": 200,
      "2024-01-02": 300,
      "2024-01-03": 50, // latest incomplete day to be popped
    }

    const aggregated = aggregateDownloadsByMonth(raw)

    expect(aggregated).toEqual([
      { date: "2023-12", downloads: 250 },
      { date: "2024-01", downloads: 500 },
    ])
  })

  it("handles null, undefined, or empty inputs gracefully", () => {
    expect(aggregateDownloadsByMonth(null)).toEqual([])
    expect(aggregateDownloadsByMonth(undefined)).toEqual([])
    expect(aggregateDownloadsByMonth({})).toEqual([])
  })

  it("handles a single entry by discarding it as incomplete", () => {
    expect(aggregateDownloadsByMonth({ "2024-01-01": 100 })).toEqual([])
  })

  it("preserves chronological order across years", () => {
    const raw = {
      "2024-02-01": 50,
      "2022-05-10": 10,
      "2023-11-20": 20,
      "2024-03-01": 1, // latest day
    }

    const aggregated = aggregateDownloadsByMonth(raw)

    expect(aggregated.map((item) => item.date)).toEqual([
      "2022-05",
      "2023-11",
      "2024-02",
    ])
  })
})

describe("month date formatting", () => {
  it("formats tick labels with short month and full year", () => {
    expect(formatMonthTick("2024-01", "en")).toBe("Jan 2024")
    expect(formatMonthTick("2024-05", "en")).toBe("May 2024")
  })

  it("formats tooltip labels with full month name and year", () => {
    expect(formatMonthTooltip("2024-01", "en")).toBe("January 2024")
    expect(formatMonthTooltip("2024-05", "en")).toBe("May 2024")
  })

  it("formats labels across localized languages", () => {
    expect(formatMonthTooltip("2024-01", "de")).toBe("Januar 2024")
    expect(formatMonthTooltip("2024-01", "fr")).toBe("janvier 2024")
  })
})

describe("downloads over time chart responsive layout", () => {
  const sampleMonthlyData = [
    { date: "2023-08", downloads: 4_500_000 },
    { date: "2023-09", downloads: 4_800_000 },
    { date: "2023-10", downloads: 5_200_000 },
    { date: "2023-11", downloads: 5_600_000 },
    { date: "2023-12", downloads: 6_100_000 },
    { date: "2024-01", downloads: 6_400_000 },
  ]

  it.each([320, 375, 640, 768, 1024, 1280])(
    "renders clean chart scene at width %spx without layout errors",
    (width) => {
      const definition = createDownloadsOverTimeChart(sampleMonthlyData, "en")
      const scene = createChartScene(definition, { width, height: 400 })

      expect(scene.points).toHaveLength(sampleMonthlyData.length)
      expect(scene.chart.width).toBeGreaterThan(0)
    },
  )

  it("provides informative monthly tooltip with formatted download count", () => {
    const definition = createDownloadsOverTimeChart(sampleMonthlyData, "en")
    const format = definition.tooltip?.format
    expect(format).toBeDefined()

    if (format) {
      const mockPoint = {
        datum: { date: "2024-01", downloads: 6_400_000 },
        yValue: 6_400_000,
      } as any

      const tooltipText = format(mockPoint)
      expect(tooltipText).toBe("January 2024: 6,400,000")
    }
  })
})
