import { NextIntlClientProvider } from "next-intl"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, expect, test, vi } from "vitest"
import common from "../../../public/locales/en/common.json"
import CountryStatistics from "./CountryStatistics"

const { map } = vi.hoisted(() => ({ map: vi.fn(() => null) }))
vi.mock("@/components/ui/country-map", () => ({ default: map }))

beforeEach(() => map.mockClear())

test("keeps absolute counts as the default and handles unknown country codes", () => {
  const countries = Object.freeze({ US: 200, DE: 100, unknown: 5 })
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={common} timeZone="UTC">
      <CountryStatistics
        stats={{
          countries,
          country_population: {
            year: 2026,
            revision: "2024",
            populations: { US: 1_000_000 },
          },
        }}
        countryNames={{ US: "United States" }}
      />
    </NextIntlClientProvider>,
  )
  expect(html).toContain("Downloads per country")
  expect(html).toContain('aria-checked="false"')
  expect(html).toContain('aria-label="Total downloads"')
  expect(html).toContain("United States")
  expect(html).toContain("Germany")
  expect(html).toContain(common.unknown)
  expect(html).not.toContain("<details")
  expect(countries).toEqual({ US: 200, DE: 100, unknown: 5 })
})

test("gives app counts install labels, a reporting period, and an unavailable control", () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={common} timeZone="UTC">
      <CountryStatistics
        metric="installs"
        stats={{ countries: { DE: 100 } }}
        periodLabel="Since April 15, 2024"
      />
    </NextIntlClientProvider>,
  )
  expect(html).toContain("Installs by country")
  expect(html).toContain("Installs, not individual users.")
  expect(html).toContain('aria-label="Total installs"')
  expect(html).toContain("disabled")
  expect(html).toContain("Since April 15, 2024")
})

test("explains when there are no country statistics instead of inventing ranking rows", () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={common} timeZone="UTC">
      <CountryStatistics stats={{ countries: {} }} />
    </NextIntlClientProvider>,
  )
  expect(html).toContain("Country statistics are not available yet.")
  expect(html).not.toContain('role="listitem"')
})
