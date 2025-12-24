import { Metadata } from "next"
import { notFound } from "next/navigation"
import { setRequestLocale, getTranslations } from "next-intl/server"
import {
  getYearInReviewYearInReviewYearGet,
  YearInReviewResult,
} from "../../../../src/codegen"
import { YearInReview } from "../../../../src/components/application/YearInReview"
import { Link } from "src/i18n/navigation"
import clsx from "clsx"

const MIN_YEAR = 2018
const CURRENT_YEAR = new Date().getFullYear()

export async function generateStaticParams() {
  const years: { year: string }[] = []
  for (
    let year = CURRENT_YEAR;
    year >= CURRENT_YEAR - 5 && year >= MIN_YEAR;
    year--
  ) {
    years.push({ year: year.toString() })
  }
  return years
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; year: string }>
}): Promise<Metadata> {
  const { locale, year } = await params
  const t = await getTranslations({ locale })

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
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/api/yearInReviewOgImage/${year}?locale=${locale}`,
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
        `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/api/yearInReviewOgImage/${year}?locale=${locale}`,
      ],
    },
  }
}

export const dynamic = "force-static"
export const revalidate = 3600 // Revalidate every hour

export default async function YearInReviewPage({
  params,
}: {
  params: Promise<{ locale: string; year: string }>
}) {
  const { locale, year: yearParam } = await params

  setRequestLocale(locale)

  const t = await getTranslations({ locale })

  const year = parseInt(yearParam, 10)

  if (isNaN(year) || year < MIN_YEAR || year > CURRENT_YEAR) {
    notFound()
  }

  let yearInReviewData: YearInReviewResult | null = null
  try {
    const yearInReviewResponse = await getYearInReviewYearInReviewYearGet(
      year,
      {
        locale,
      },
    )
    yearInReviewData = yearInReviewResponse.data
  } catch (error) {
    notFound()
  }

  if (!yearInReviewData) {
    notFound()
  }

  const hasPreviousYear = yearInReviewData.year > MIN_YEAR
  const hasGeographicData =
    yearInReviewData.year >= 2024 && !!yearInReviewData.geographic_stats

  const availableYears: number[] = []
  for (let y = CURRENT_YEAR; y >= MIN_YEAR; y--) {
    availableYears.push(y)
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="space-y-8 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 ms-auto">
            <span className="text-sm font-medium text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70">
              {t("year-in-review.select-year")}:
            </span>
            <div className="flex flex-wrap gap-2">
              {availableYears.slice(0, 8).map((y) => (
                <Link
                  key={y}
                  href={`/year-in-review/${y}`}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                    y === year
                      ? "bg-flathub-celestial-blue text-white shadow-md"
                      : "bg-flathub-gainsborow/30 text-flathub-dark-gunmetal hover:bg-flathub-celestial-blue/20 dark:bg-flathub-arsenic/30 dark:text-flathub-gainsborow dark:hover:bg-flathub-celestial-blue/30",
                  )}
                >
                  {y}
                </Link>
              ))}
            </div>
          </div>
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
          topEmulators={yearInReviewData.top_emulators}
          topGameStores={yearInReviewData.top_game_stores}
          topGameUtilities={yearInReviewData.top_game_utilities}
          popularAppsByCategory={yearInReviewData.popular_apps_by_category}
          biggestGrowthByCategory={yearInReviewData.biggest_growth_by_category}
          newcomersByCategory={yearInReviewData.newcomers_by_category}
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
            <span className="inline-block rtl:rotate-180">←</span>{" "}
            {t("go-home")}
          </Link>
        </div>
      </div>
    </div>
  )
}
