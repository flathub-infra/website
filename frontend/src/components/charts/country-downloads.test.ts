import { describe, expect, it } from "vitest"
import { getCountryDownloads, getCountryMapValues } from "./country-downloads"

describe("country download metrics", () => {
  const countries = { US: 200, DE: 100, AX: 50, FR: 0 }
  const populations = { US: 1_000_000, DE: 100_000, FR: 100_000 }

  it("preserves raw counts and their ranking by default", () => {
    expect(getCountryDownloads(countries, populations, false)).toEqual([
      { country: "US", downloads: 200, value: 200 },
      { country: "DE", downloads: 100, value: 100 },
      { country: "AX", downloads: 50, value: 50 },
      { country: "FR", downloads: 0, value: 0 },
    ])
  })

  it("normalizes and reorders countries, keeping unavailable populations last", () => {
    expect(getCountryDownloads(countries, populations, true)).toEqual([
      { country: "DE", downloads: 100, value: 100 },
      { country: "US", downloads: 200, value: 20 },
      { country: "FR", downloads: 0, value: 0 },
      { country: "AX", downloads: 50, value: null },
    ])
  })

  it.each([undefined, 0, -1, NaN, Infinity])(
    "does not divide by an unavailable or invalid population: %s",
    (population) => {
      const values = population === undefined ? {} : { US: population }
      expect(getCountryDownloads({ US: 10 }, values, true)[0].value).toBeNull()
    },
  )

  it("matches lowercase statistics codes and preserves fractional rates", () => {
    const [row] = getCountryDownloads({ us: 1 }, { US: 3_000_000 }, true)
    expect(row.country).toBe("us")
    expect(row.value).toBeCloseTo(1 / 30)
  })

  it("does not mutate API data and handles absent population metadata", () => {
    expect(
      getCountryDownloads(Object.freeze(countries), undefined, true),
    ).toEqual(
      Object.entries(countries).map(([country, downloads]) => ({
        country,
        downloads,
        value: null,
      })),
    )
  })
})

describe("country map values", () => {
  const countries = Object.freeze([
    { country: "us", downloads: 10, value: 1 },
    { country: "AX", downloads: 5, value: null },
  ])

  it("adds zero rates only for unreported countries with valid populations", () => {
    expect(
      getCountryMapValues(
        countries,
        {
          US: 1_000_000,
          DE: 100_000,
          FR: 0,
          GB: -1,
          CA: NaN,
          JP: Infinity,
        },
        true,
      ),
    ).toEqual([
      { country: "us", value: 1 },
      { country: "AX", value: null },
      { country: "DE", value: 0 },
    ])
  })

  it("does not add population-only countries in absolute mode", () => {
    expect(getCountryMapValues(countries, { DE: 100_000 }, false)).toEqual([
      { country: "us", value: 1 },
      { country: "AX", value: null },
    ])
  })

  it("handles missing population metadata and leaves ranking rows unchanged", () => {
    expect(getCountryMapValues(countries, undefined, true)).toEqual([
      { country: "us", value: 1 },
      { country: "AX", value: null },
    ])
    const population = Object.freeze({ US: 1_000_000, DE: 100_000 })
    getCountryMapValues(countries, population, true)
    expect(countries).toHaveLength(2)
    expect(countries[0]).toEqual({ country: "us", downloads: 10, value: 1 })
  })
})
