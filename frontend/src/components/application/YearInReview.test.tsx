import { readFileSync } from "node:fs"
import deepmerge from "deepmerge"
import { renderToStaticMarkup } from "react-dom/server"
import { createTranslator, NextIntlClientProvider } from "next-intl"
import { expect, test, vi } from "vitest"
import {
  CategoryHighlightsSection,
  PlatformDiversitySection,
  TopAppsSection,
  TrendingCategoriesSection,
  YearStatsGrid,
  YearInReview,
} from "./YearInReview"
import common from "../../../public/locales/en/common.json"

vi.mock("../LogoImage", () => ({ default: () => null }))

vi.mock("src/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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
          totalApps={3000}
          updatesCount={12345}
          year={2025}
          totalDownloads={1234567}
          change={12.3}
          delta={135218}
          hasPreviousYear
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
                    {
                      type: "improved",
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
    expect(html).toContain(
      `>${new Intl.NumberFormat(locale).format(3000)}</dd>`,
    )
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
    const growthMessage = messages["year-in-review"][
      "x-growth-formatted"
    ].replace(
      "{percentage}",
      new Intl.NumberFormat(locale, {
        style: "percent",
        signDisplay: "always",
      }).format(12.34),
    )
    expect(html).toContain(growthMessage)
    expect(html).toContain(
      createTranslator({ locale, messages })("year-in-review.more-downloads", {
        count: 1234,
      }),
    )
  },
)

test("the English growth message accepts a fully formatted percentage", () => {
  const message = common["year-in-review"]["x-growth-formatted"]
  expect(message).toContain("{percentage}")
  expect(message).not.toMatch(/[+%٪]/)
})

test.each([3, 5, 10])(
  "shows known chart movement and only labels absences with top-ten coverage (%i)",
  (limit) => {
    const games = Array.from({ length: 10 }, (_, index) => ({
      app_id: `org.example.Game${index + 1}`,
      name: `Game ${index + 1}`,
      downloads: 100 - index,
      icon: "",
      summary: "",
    }))
    const prior = Array.from({ length: limit }, (_, index) => `prior-${index}`)
    prior[limit === 10 ? 7 : 1] = games[0].app_id

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={common} timeZone="UTC">
        <TopAppsSection
          year={2025}
          topApps={[]}
          topGames={games}
          topEmulators={[]}
          topGameStores={[]}
          topGameUtilities={[]}
          previousCharts={{ limit, "top-apps": [], "top-games": prior }}
        />
      </NextIntlClientProvider>,
    )
    const t = createTranslator({ locale: "en", messages: common })

    expect(html).toContain(
      `title="${t("year-in-review.previous-rank", {
        rank: limit === 10 ? 8 : 2,
        year: 2024,
      })}"`,
    )
    expect(html).toContain(
      `<span aria-hidden="true">${limit === 10 ? 7 : 1}</span>`,
    )
    expect(html).toContain(`href="/apps/${games[4].app_id}"`)
    expect(html).not.toContain(`href="/apps/${games[5].app_id}"`)
    const outside = `title="${t("year-in-review.outside-previous-top-ten")}"`
    if (limit === 10) {
      expect(html).toContain(outside)
    } else {
      expect(html).not.toContain(outside)
    }
  },
)

test("growth leaders match the displayed category and link only to available apps", () => {
  const render = (category: string, unavailableAppIds: string[]) =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={common} timeZone="UTC">
        <TrendingCategoriesSection
          year={2025}
          trendingCategories={[
            {
              category: "utility",
              growth: 50,
              growth_percentage: 50,
              current_year_downloads: 150,
              previous_year_downloads: 100,
            },
          ]}
          biggestGrowthByCategory={[
            {
              category,
              app_id: "org.example.App",
              name: "Historical app",
              icon: "",
              summary: "",
              growth: 10,
              growth_percentage: 1,
            },
          ]}
          getCategoryDisplayName={(category) => category}
          unavailableAppIds={unavailableAppIds}
        />
      </NextIntlClientProvider>,
    )
  expect(render("game", [])).not.toContain("Historical app")
  const archived = render("utility", ["org.example.App"])
  expect(archived).toContain("Historical app")
  expect(archived).not.toContain('href="/apps/org.example.App"')
  expect(render("utility", [])).toContain('href="/apps/org.example.App"')
})

test("a year without arrivals reports zero without drawing an empty spiral", () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={common} timeZone="UTC">
      <YearInReview
        year={2025}
        totalDownloads={200}
        newAppsCount={0}
        totalApps={4}
        updatesCount={8}
        totalDownloadsChange={20}
        totalDownloadsChangePercentage={11.1}
        topApps={[]}
        topGames={[]}
        topEmulators={[]}
        topGameStores={[]}
        topGameUtilities={[]}
      />
    </NextIntlClientProvider>,
  )
  expect(html).toContain("0 apps joined Flathub in 2025.")
  expect(html).not.toContain("review-spectrum-")
})
