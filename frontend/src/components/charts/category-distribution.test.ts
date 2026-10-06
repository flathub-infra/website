import { createChartScene } from "@tanstack/charts"
import { describe, expect, it } from "vitest"
import { createCategoryDistributionChart } from "./category-distribution"

const categories = [
  { name: "Audio und Video", value: 364 },
  { name: "Entwicklung", value: 266 },
  { name: "Bildung", value: 173 },
  { name: "Spiele", value: 731 },
  { name: "Grafik", value: 224 },
  { name: "Netzwerk", value: 330 },
  { name: "Büro", value: 250 },
  { name: "Wissenschaft", value: 79 },
  { name: "System", value: 103 },
  { name: "Dienstprogramme", value: 739 },
]

describe("category distribution responsive layout", () => {
  it("includes the category count in the hover tooltip", () => {
    const definition = createCategoryDistributionChart(categories, "de", [
      "#3584e4",
    ])
    const scene = createChartScene(definition, { width: 640, height: 500 })
    const options = definition.tooltip
    if (!options || !("content" in options) || !options.content) {
      throw new Error("Expected structured category tooltip content")
    }
    const science = scene.points.filter(
      (point) => point.datum.data?.name === "Wissenschaft",
    )
    expect(science).toHaveLength(1)
    const content = options.content(science)
    expect(content.rows).toEqual([
      expect.objectContaining({ label: "Wissenschaft", value: "79" }),
    ])
  })

  it.each([87, 320, 375.5, 640, 768.5, 1024, 1280])(
    "keeps all categories inside a %spx chart",
    (width) => {
      const definition = createCategoryDistributionChart(categories, "de", [
        "#3584e4",
      ])
      const scene = createChartScene(definition, { width, height: 500 })
      expect(scene.points).toHaveLength(categories.length)
      for (const point of scene.points) {
        expect(point.x).toBeGreaterThanOrEqual(0)
        expect(point.x).toBeLessThanOrEqual(width)
        expect(point.y).toBeGreaterThanOrEqual(0)
        expect(point.y).toBeLessThanOrEqual(500)
      }
    },
  )
})
