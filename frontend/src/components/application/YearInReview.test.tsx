import { readFileSync } from "node:fs"
import deepmerge from "deepmerge"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { expect, test, vi } from "vitest"
import {
  CategoryHighlightsSection,
  PlatformDiversitySection,
  YearStatsGrid,
} from "./YearInReview"
import common from "../../../public/locales/en/common.json"

vi.mock("../LogoImage", () => ({ default: () => null }))

vi.mock("src/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

test.each(["en", "de", "tr", "ar", "ja"])(
  "renders localized counts and percentages for %s",
  (locale) => {
    const messages = deepmerge(
      common,
      JSON.parse(
        readFileSync(
          new URL(
            `../../../public/locales/${locale}/common.json`,
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    )
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone="UTC"
      >
        <YearStatsGrid
          year={2025}
          totalDownloads={1234567}
          newAppsCount={1000}
          totalApps={3000}
          updatesCount={12345}
          totalDownloadsChange={1234}
          totalDownloadsChangePercentage={12.3}
        />
        <PlatformDiversitySection
          platformStats={[
            { architecture: "x86_64", downloads: 12345, percentage: 87.6 },
          ]}
        />
        <CategoryHighlightsSection
          categoriesData={[
            {
              category: "utility",
              category_name: "Utilities",
              winners: [
                {
                  app_id: "test.App",
                  name: "Test",
                  icon: null,
                  summary: null,
                  awards: [
                    {
                      type: "growth",
                      data: {
                        app_id: "test.App",
                        name: "Test",
                        icon: null,
                        summary: null,
                        category: "utility",
                        growth: 1234,
                        growth_percentage: 1234,
                      },
                    },
                  ],
                },
              ],
            },
          ]}
        />
      </NextIntlClientProvider>,
    )
    for (const value of [1000, 3000]) {
      const formatted = new Intl.NumberFormat(locale).format(value)
      expect(html).toContain(`<span aria-hidden="true">${formatted}</span>`)
      expect(html).toContain(`<span class="sr-only">${formatted}</span>`)
    }
    expect(html).toContain(
      new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(1234567),
    )
    for (const [value, signed] of [
      [0.123, true],
      [0.876, false],
    ] as const) {
      expect(html).toContain(
        new Intl.NumberFormat(locale, {
          style: "percent",
          signDisplay: signed ? "always" : "auto",
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value),
      )
    }
    expect(html).toContain(
      `${new Intl.NumberFormat(locale, {
        style: "percent",
        signDisplay: "always",
      }).format(12.34)} growth`,
    )
  },
)

test("the English growth message accepts a fully formatted percentage", () => {
  const message = common["year-in-review"]["x-growth-formatted"]
  expect(message).toContain("{percentage}")
  expect(message).not.toMatch(/[+%٪]/)
})
