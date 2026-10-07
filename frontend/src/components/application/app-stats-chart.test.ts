import { createChartScene } from "@tanstack/charts"
import { describe, expect, it } from "vitest"
import { createAppStatsChart, formatInstallDate } from "./app-stats-chart"

const data = Array.from({ length: 180 }, (_, index) => {
  const date = new Date(Date.UTC(2025, 0, 1 + index))
  return {
    date: date.toISOString().slice(0, 10),
    installs: index * 3,
  }
})

describe("app install history chart", () => {
  it.each(["ar", "fa", "he", "en"])(
    "lays out readable, unrotated date labels at narrow and wide widths (%s)",
    (locale) => {
      const definition = createAppStatsChart(data, locale)

      expect(definition.scales.x?.axis?.tickLabels).not.toHaveProperty("rotate")
      expect(definition.scales.x?.axis?.ticks).toHaveProperty("spacing", 72)

      for (const width of [320, 640, 1280]) {
        const scene = createChartScene(definition, { width, height: 400 })
        expect(scene.points).toHaveLength(data.length)
        expect(scene.chart.width).toBeGreaterThan(0)
      }
    },
  )

  it("formats dates using the selected language", () => {
    expect(formatInstallDate("2025-04-08", "ar")).toContain("أبريل")
    expect(formatInstallDate("2025-04-08", "fa")).toContain("آوریل")
    expect(formatInstallDate("2025-04-08", "he")).toContain("באפר")
  })
})
