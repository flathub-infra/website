import { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import {
  getYearInReviewYearInReviewYearGet,
  YearInReviewResult,
} from "../../../../src/codegen"
import { YearInReview } from "../../../../src/components/application/YearInReview"
import { Link } from "src/i18n/navigation"
import { buttonVariants } from "@/components/ui/button"

const MIN_YEAR = 2018

function getMaxAvailableYear(): number {
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth()
  const currentDay = now.getUTCDate()

  const isLateDecember = currentMonth === 11 && currentDay >= 15

  return isLateDecember ? currentYear : currentYear - 1
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; year: string }>
}): Promise<Metadata> {
  const { locale, year } = await params
  const t = await getTranslations()

  return {
    title: t("year-in-review.title", { year }),
    description: t("year-in-review.description"),
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/year-in-review/${year}`,
    },
    openGraph: {
      title: t("year-in-review.title", { year }) + " - Flathub",
      description: t("year-in-review.description"),
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/year-in-review/${year}`,
      images: [
        {
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/api/yearInReviewOgImage/${year}?locale=${locale}&v=2`,
          width: 1200,
          height: 630,
          alt: `Flathub ${t("year-in-review.title", { year })}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${t("year-in-review.title", { year })} - Flathub`,
      description: t("year-in-review.description"),
      images: [
        `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/api/yearInReviewOgImage/${year}?locale=${locale}&v=2`,
      ],
    },
  }
}

export const dynamic = "force-dynamic"

export default async function YearInReviewPage({
  params,
}: {
  params: Promise<{ locale: string; year: string }>
}) {
  const { locale, year: yearParam } = await params

  const t = await getTranslations()

  const year = Number(yearParam)
  const publicMaxYear = getMaxAvailableYear()

  if (
    !Number.isInteger(year) ||
    year < MIN_YEAR ||
    year > new Date().getUTCFullYear()
  ) {
    notFound()
  }

  // Only unreleased years need authentication.
  // The API checks the session's admin permission before returning preview data.
  const cookie = year > publicMaxYear ? (await headers()).get("cookie") : null

  let yearInReviewData: YearInReviewResult | null = null
  let previous: YearInReviewResult | null = null
  try {
    const [yearInReviewResponse, priorResponse] = await Promise.all([
      getYearInReviewYearInReviewYearGet(
        year,
        { locale },
        cookie ? { headers: { Cookie: cookie } } : undefined,
      ),
      year > MIN_YEAR
        ? getYearInReviewYearInReviewYearGet(
            year - 1,
            { locale },
            { signal: AbortSignal.timeout(1500) },
          ).catch(() => null)
        : null,
    ])
    yearInReviewData = yearInReviewResponse.data
    previous = priorResponse?.data
  } catch (error) {
    notFound()
  }

  if (!yearInReviewData) {
    notFound()
  }

  const hasPreviousYear = yearInReviewData.year > MIN_YEAR
  const previousCharts = previous
    ? {
        limit: previous.top_chart_limit ?? 3,
        "top-apps": previous.top_apps.map((app) => app.app_id),
        "top-games": previous.top_games.map((app) => app.app_id),
      }
    : undefined
  const hasGeographicData =
    yearInReviewData.year >= 2024 && !!yearInReviewData.geographic_stats

  const availableYears: number[] = []
  const maxYear = Math.max(publicMaxYear, year)
  for (let y = maxYear; y >= MIN_YEAR; y--) {
    availableYears.push(y)
  }

  return (
    <div className="mx-auto w-11/12 max-w-[1240px]">
      <div className="space-y-4 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <nav
            aria-label={t("year-in-review.select-year")}
            className="flex items-center gap-2 overflow-x-auto py-1"
          >
            <span className="shrink-0 text-sm font-medium text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70">
              {t("year-in-review.select-year")}:
            </span>
            <div className="flex gap-2">
              {availableYears.slice(0, 8).map((y) => (
                <Link
                  key={y}
                  href={`/year-in-review/${y}`}
                  aria-current={y === year ? "page" : undefined}
                  className={buttonVariants({
                    variant: y === year ? "selected" : "ghost",
                    size: "sm",
                  })}
                >
                  {y}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <YearInReview
          year={yearInReviewData.year}
          totalDownloads={yearInReviewData.total_downloads}
          newAppsCount={yearInReviewData.new_apps_count}
          totalApps={yearInReviewData.total_apps}
          updatesCount={yearInReviewData.updates_count}
          totalDownloadsChange={yearInReviewData.total_downloads_change}
          totalDownloadsChangePercentage={
            yearInReviewData.total_downloads_change_percentage
          }
          hasPreviousYear={hasPreviousYear}
          topApps={yearInReviewData.top_apps}
          topGames={yearInReviewData.top_games}
          previousCharts={previousCharts}
          topEmulators={yearInReviewData.top_emulators}
          topGameStores={yearInReviewData.top_game_stores}
          topGameUtilities={yearInReviewData.top_game_utilities}
          popularAppsByCategory={yearInReviewData.popular_apps_by_category}
          biggestGrowthByCategory={yearInReviewData.biggest_growth_by_category}
          newcomersByCategory={yearInReviewData.newcomers_by_category}
          unavailableAppIds={yearInReviewData.unavailable_app_ids}
          mostImprovedByCategory={yearInReviewData.most_improved_by_category}
          geographicStats={yearInReviewData.geographic_stats}
          hiddenGems={yearInReviewData.hidden_gems}
          platformStats={yearInReviewData.platform_stats}
          trendingCategories={yearInReviewData.trending_categories}
          hasGeographicData={hasGeographicData}
        />

        <div className="pt-4 text-center">
          <Link
            href="/"
            className="text-flathub-celestial-blue hover:text-flathub-electric-purple transition-colors"
          >
            <span aria-hidden="true" className="inline-block rtl:rotate-180">
              ←
            </span>{" "}
            {t("go-home")}
          </Link>
        </div>
      </div>
    </div>
  )
}
