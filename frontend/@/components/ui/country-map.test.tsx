import type { ScaleSequential } from "d3-scale"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CountryMap, { type CountryMapValue } from "./country-map"

const { chart } = vi.hoisted(() => ({
  chart: vi.fn<
    (props: {
      definition: { color: { scale: () => ScaleSequential<string> } }
    }) => null
  >(() => null),
}))

vi.mock("@tanstack/charts/react", () => ({ Chart: chart }))
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))

function getColorScale(data: CountryMapValue[]) {
  renderToStaticMarkup(<CountryMap data={data} />)
  return chart.mock.lastCall![0].definition.color.scale()
}

function getPercentage(color: string) {
  return Number(color.match(/ ([\d.]+)%\)$/)![1])
}

describe("country map colors", () => {
  beforeEach(() => chart.mockClear())

  it("keeps small positive counts visibly distinct from zero", () => {
    const color = getColorScale([
      { country: "US", value: 5000 },
      { country: "JP", value: 1 },
      { country: "CA", value: 0 },
    ])

    expect(getPercentage(color(0))).toBe(0)
    expect(getPercentage(color(1))).toBeGreaterThanOrEqual(20)
    expect(getPercentage(color(5000))).toBe(100)
  })

  it("preserves differences between small positive counts without rounding", () => {
    const color = getColorScale([{ country: "US", value: 5000 }])

    expect(getPercentage(color(2))).toBeGreaterThan(getPercentage(color(1)))
    expect(getPercentage(color(25))).toBeGreaterThan(getPercentage(color(2)))
  })

  it("keeps empty and all-zero datasets at the background color", () => {
    expect(getPercentage(getColorScale([])(0))).toBe(0)
    expect(getPercentage(getColorScale([{ country: "CA", value: 0 }])(0))).toBe(
      0,
    )
  })

  it("uses the same scale regardless of which country has the maximum", () => {
    const usMaximum = getColorScale([{ country: "US", value: 5000 }])
    const jpMaximum = getColorScale([{ country: "JP", value: 5000 }])

    expect(jpMaximum(1)).toBe(usMaximum(1))
    expect(jpMaximum(5000)).toBe(usMaximum(5000))
  })
})
