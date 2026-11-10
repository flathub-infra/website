import type { ScaleSequential } from "d3-scale"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CountryMap, {
  COUNTRY_MAP_NO_DATA_COLOR,
  type CountryMapValue,
} from "./country-map"

type TestCountry = { properties: { countryCode: string; value: number | null } }

const { chart, shape } = vi.hoisted(() => ({
  chart: vi.fn<
    (props: {
      aspectRatio: number
      definition: {
        color: { scale: () => ScaleSequential<string> }
        tooltip: { format: (point: { datum: TestCountry }) => string }
      }
    }) => null
  >(() => null),
  shape:
    vi.fn<
      (
        rows: TestCountry[],
        options: { fill: (country: TestCountry) => string },
      ) => void
    >(),
}))

vi.mock("@tanstack/charts/react", () => ({ Chart: chart }))
vi.mock("@tanstack/charts/geo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@tanstack/charts/geo")>()
  return {
    ...original,
    geoShape: (...args: Parameters<typeof original.geoShape>) => {
      shape(
        args[0] as TestCountry[],
        args[1] as unknown as Parameters<typeof shape>[1],
      )
      return original.geoShape(...args)
    },
  }
})
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

function getColorScale(data: CountryMapValue[]) {
  renderToStaticMarkup(<CountryMap data={data} />)
  return chart.mock.lastCall![0].definition.color.scale()
}

function getPercentage(color: string) {
  return Number(color.match(/ ([\d.]+)%\)$/)![1])
}

describe("country map colors", () => {
  beforeEach(() => {
    chart.mockClear()
    shape.mockClear()
  })

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

  it("offers a compact world map without removing countries", () => {
    renderToStaticMarkup(<CountryMap compact data={[]} />)
    expect(chart.mock.lastCall![0].aspectRatio).toBe(2)
    const [rows] = shape.mock.lastCall!
    expect(
      rows.some((country) => country.properties.countryCode === "AQ"),
    ).toBe(true)
    expect(
      rows.some((country) => country.properties.countryCode === "US"),
    ).toBe(true)
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

  it("distinguishes missing population from a genuine zero rate", () => {
    renderToStaticMarkup(
      <CountryMap
        metric="downloads-per-capita"
        data={[
          { country: "US", value: 12.5 },
          { country: "CA", value: 0 },
          { country: "NF", value: null },
        ]}
      />,
    )
    const [rows, options] = shape.mock.lastCall!
    const country = (code: string) =>
      rows.find((row) => row.properties.countryCode === code)!
    const zero = country("CA")
    const unavailable = country("NF")
    expect(unavailable.properties.value).toBeNull()
    expect(options.fill(unavailable)).toBe(COUNTRY_MAP_NO_DATA_COLOR)
    expect(options.fill(zero)).not.toBe(COUNTRY_MAP_NO_DATA_COLOR)
    expect(chart.mock.lastCall![0].definition.color.scale().domain()).toEqual([
      0, 12.5,
    ])
    const format = chart.mock.lastCall![0].definition.tooltip.format
    expect(format({ datum: unavailable })).toContain(
      "country-downloads.population-unavailable",
    )
    expect(format({ datum: country("US") })).toContain(
      "country-downloads.x-per-100000",
    )
  })

  it("labels app rates as installs and retains raw totals, including missing populations", () => {
    renderToStaticMarkup(
      <CountryMap
        metric="installs-per-capita"
        totals={{ US: 100, NF: 50 }}
        data={[
          { country: "US", value: 12.5 },
          { country: "NF", value: null },
        ]}
      />,
    )
    const [rows] = shape.mock.lastCall!
    const format = chart.mock.lastCall![0].definition.tooltip.format
    const country = (code: string) =>
      rows.find((row) => row.properties.countryCode === code)!
    expect(format({ datum: country("US") })).toContain(
      "country-installs.x-per-100000",
    )
    expect(format({ datum: country("US") })).toContain(
      "country-downloads.x-total",
    )
    expect(format({ datum: country("US") })).toContain('"x":"100"')
    expect(format({ datum: country("NF") })).toContain(
      "country-downloads.population-unavailable",
    )
    expect(format({ datum: country("NF") })).toContain(
      "country-downloads.x-total",
    )
    expect(format({ datum: country("NF") })).toContain('"x":"50"')
    expect(country("GL").properties.value).toBeNull()
  })
})
