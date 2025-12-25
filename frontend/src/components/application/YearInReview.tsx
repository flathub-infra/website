"use client"

import { useLocale, useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"
import { useEffect, useState, useMemo, useCallback } from "react"
import clsx from "clsx"
import LogoImage from "../LogoImage"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type {
  YearInReviewMostPopularApp,
  YearInReviewCategoryApp,
  YearInReviewCategoryGrowthApp,
  YearInReviewGeographicStats,
  PlatformStats,
  HiddenGem,
  TrendingCategory,
} from "../../codegen"
import { MainCategory } from "../../codegen"
import { categoryToName, stringToCategory } from "../../types/Category"

const categoryOrder: MainCategory[] = [
  MainCategory.office,
  MainCategory.graphics,
  MainCategory.audiovideo,
  MainCategory.education,
  MainCategory.game,
  MainCategory.network,
  MainCategory.development,
  MainCategory.science,
  MainCategory.system,
  MainCategory.utility,
]

interface YearInReviewProps {
  year: number
  totalDownloads: number
  newAppsCount: number
  totalApps: number
  updatesCount: number
  totalDownloadsChange: number
  totalDownloadsChangePercentage: number
  hasPreviousYear?: boolean
  topApps: YearInReviewMostPopularApp[]
  topGames: YearInReviewMostPopularApp[]
  topEmulators: YearInReviewMostPopularApp[]
  topGameStores: YearInReviewMostPopularApp[]
  topGameUtilities: YearInReviewMostPopularApp[]
  popularAppsByCategory?: YearInReviewCategoryApp[]
  biggestGrowthByCategory?: YearInReviewCategoryGrowthApp[]
  newcomersByCategory?: YearInReviewCategoryApp[]
  mostImprovedByCategory?: YearInReviewCategoryGrowthApp[]
  geographicStats?: YearInReviewGeographicStats
  hiddenGems?: HiddenGem[]
  trendingCategories?: TrendingCategory[]
  platformStats?: PlatformStats[]
  hasGeographicData?: boolean
}

interface Award {
  type: "popular" | "growth" | "newcomer" | "improved"
  data: YearInReviewCategoryApp | YearInReviewCategoryGrowthApp
}

interface CategoryAppWinner {
  app_id: string
  name: string
  icon: string | null
  summary: string | null
  awards: Award[]
}

function AnimatedCounter({
  value,
  duration = 2000,
}: {
  value: number
  duration?: number
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number | null = null
    let animationFrameId: number | null = null

    const animate = (currentTime: number) => {
      if (startTime === null) {
        startTime = currentTime
      }
      const progress = Math.min((currentTime - startTime) / duration, 1)

      setCount(Math.floor(progress * value))

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate)
      }
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [value, duration])

  return <>{count.toLocaleString()}</>
}

function RankBadge({
  rank,
  size = "md",
  color = "celestial-blue",
  variant = "absolute",
}: {
  rank: number
  size?: "sm" | "md" | "lg"
  color?: "celestial-blue"
  variant?: "absolute" | "inline"
}) {
  const sizeClasses = {
    sm: "w-5 h-5 text-[10px]",
    md: "w-8 h-8 text-sm",
    lg: "w-12 h-12 text-lg",
  }

  const colorClasses = {
    "celestial-blue": "bg-flathub-celestial-blue",
  }

  const positionClasses = {
    absolute: {
      sm: "absolute -start-1 -top-1",
      md: "absolute -start-2 -top-2",
      lg: "absolute -start-3 -top-3",
    },
    inline: "",
  }

  return (
    <div
      className={clsx(
        "flex items-center justify-center rounded-full font-black text-white shadow-md",
        sizeClasses[size],
        colorClasses[color],
        variant === "absolute" ? positionClasses.absolute[size] : "",
      )}
    >
      {rank}
    </div>
  )
}

export function YearStatsGrid({
  year,
  totalDownloads,
  newAppsCount,
  totalApps,
  updatesCount,
  totalDownloadsChange,
  totalDownloadsChangePercentage,
  hasPreviousYear = true,
}: {
  year: number
  totalDownloads: number
  newAppsCount: number
  totalApps: number
  updatesCount: number
  totalDownloadsChange: number
  totalDownloadsChangePercentage: number
  hasPreviousYear?: boolean
}) {
  const t = useTranslations()
  const locale = useLocale()

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
        <div className="text-center p-4 lg:p-6 rounded-xl bg-white dark:bg-flathub-arsenic border-0 lg:border border-flathub-gainsborow/30 dark:border-flathub-arsenic shadow-lg hover:shadow-xl transition-shadow">
          <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-flathub-celestial-blue mb-2 lg:mb-3">
            {new Intl.NumberFormat(locale, {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(totalDownloads)}
          </div>
          <div className="text-xs sm:text-sm font-bold text-flathub-dark-gunmetal/80 dark:text-flathub-gainsborow uppercase tracking-wide">
            {t("year-in-review.total-downloads")}
          </div>
        </div>
        <div className="text-center p-4 lg:p-6 rounded-xl bg-gradient-to-br from-flathub-vivid-crimson/5 to-flathub-sunset-pink/10 dark:from-flathub-vivid-crimson/10 dark:to-flathub-sunset-pink/20 border-0 lg:border border-flathub-vivid-crimson/20 dark:border-flathub-sunset-pink/30 shadow-lg hover:shadow-xl transition-shadow">
          <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-flathub-vivid-crimson to-flathub-sunset-pink mb-2 lg:mb-3">
            <AnimatedCounter value={newAppsCount} duration={1500} />
          </div>
          <div className="text-xs sm:text-sm font-bold text-flathub-dark-gunmetal/80 dark:text-flathub-gainsborow uppercase tracking-wide">
            {t("year-in-review.new-apps")}
          </div>
        </div>
        <div className="text-center p-4 lg:p-6 rounded-xl bg-white dark:bg-flathub-arsenic border-0 lg:border border-flathub-gainsborow/30 dark:border-flathub-arsenic shadow-lg hover:shadow-xl transition-shadow">
          <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-flathub-celestial-blue mb-2 lg:mb-3">
            <AnimatedCounter value={totalApps} duration={1500} />
          </div>
          <div className="text-xs sm:text-sm font-bold text-flathub-dark-gunmetal/80 dark:text-flathub-gainsborow uppercase tracking-wide">
            {t("year-in-review.total-apps")}
          </div>
        </div>
        <div className="text-center p-4 lg:p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100/50 dark:from-emerald-950/30 dark:to-green-900/20 border-0 lg:border border-emerald-200/50 dark:border-emerald-800/30 shadow-lg hover:shadow-xl transition-shadow">
          <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-flathub-status-green dark:text-flathub-status-green-dark mb-2 lg:mb-3">
            {new Intl.NumberFormat(locale, {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(updatesCount)}
          </div>
          <div className="text-xs sm:text-sm font-bold text-flathub-dark-gunmetal/80 dark:text-flathub-gainsborow uppercase tracking-wide">
            {t("year-in-review.app-updates")}
          </div>
        </div>
      </div>

      {/* Year over year growth banner */}
      {hasPreviousYear && (
        <div className="relative overflow-hidden p-5 lg:p-6 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-pink-500/20 border-0 lg:border border-blue-300/30 dark:border-blue-500/30 shadow-lg mb-10">
          <div className="absolute inset-0 bg-gradient-to-r from-flathub-celestial-blue/5 via-purple-500/5 to-flathub-vivid-crimson/5 dark:from-flathub-celestial-blue/10 dark:via-purple-500/10 dark:to-flathub-vivid-crimson/10" />
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-flathub-celestial-blue to-purple-500 flex items-center justify-center text-2xl sm:text-3xl shadow-lg">
                📈
              </div>
              <div className="text-center sm:text-start">
                <div className="text-sm sm:text-base font-black text-flathub-dark-gunmetal dark:text-flathub-gainsborow uppercase tracking-wide">
                  {t("year-in-review.year-over-year-growth")}
                </div>
                <div className="text-xs sm:text-sm text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70">
                  {t("year-in-review.downloads-vs-previous-year", {
                    year: year - 1,
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <div
                className={clsx(
                  "text-4xl sm:text-5xl lg:text-6xl font-black",
                  totalDownloadsChange >= 0
                    ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-500 dark:from-emerald-400 dark:to-green-300"
                    : "text-transparent bg-clip-text bg-gradient-to-r from-flathub-sunset-pink to-flathub-vivid-crimson",
                )}
              >
                {totalDownloadsChange >= 0 ? "+" : ""}
                {totalDownloadsChangePercentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function TopAppsSection({
  topApps,
  topGames,
  topEmulators,
  topGameStores,
  topGameUtilities,
}: {
  topApps: YearInReviewMostPopularApp[]
  topGames: YearInReviewMostPopularApp[]
  topEmulators: YearInReviewMostPopularApp[]
  topGameStores: YearInReviewMostPopularApp[]
  topGameUtilities: YearInReviewMostPopularApp[]
}) {
  const t = useTranslations()
  const locale = useLocale()

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Apps */}
        {topApps && topApps.length > 0 && (
          <Card className="bg-white dark:bg-flathub-arsenic border-0 lg:border border-flathub-gainsborow/40 dark:border-flathub-dark-gunmetal shadow-xl">
            <CardHeader className="pb-4 px-3 sm:px-6">
              <CardTitle className="text-xl font-black flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <span>{t("year-in-review.top-apps")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-3 sm:px-6">
              <div className="space-y-4">
                {topApps.slice(0, 5).map((app, index) => (
                  <Link
                    key={app.app_id}
                    href={`/apps/${app.app_id}`}
                    className="block group"
                  >
                    <div className="relative p-4 rounded-xl bg-flathub-gainsborow/30 dark:bg-flathub-dark-gunmetal/30 hover:bg-flathub-gainsborow/50 dark:hover:bg-flathub-dark-gunmetal/50 transition-all">
                      <RankBadge
                        rank={index + 1}
                        size="lg"
                        color="celestial-blue"
                      />
                      <div className="flex items-start gap-4 ms-6">
                        <div className="w-16 h-16 flex-shrink-0">
                          {app.icon && (
                            <LogoImage
                              iconUrl={app.icon}
                              appName={app.name}
                              size="128"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-bold text-flathub-dark-gunmetal dark:text-flathub-gainsborow group-hover:text-flathub-celestial-blue transition-colors">
                            {app.name}
                          </div>
                          <div className="text-sm mt-1 text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70 line-clamp-2 min-h-[2.5rem]">
                            {app.summary}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="text-sm font-semibold text-flathub-celestial-blue dark:text-flathub-celestial-blue">
                              {new Intl.NumberFormat(locale, {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }).format(app.downloads)}
                            </div>
                            <div className="text-xs text-flathub-dark-gunmetal/60 dark:text-flathub-gainsborow/80">
                              {t("downloads")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Games */}
        {topGames && topGames.length > 0 && (
          <Card className="bg-white dark:bg-flathub-arsenic border-0 lg:border border-flathub-gainsborow/40 dark:border-flathub-dark-gunmetal shadow-xl">
            <CardHeader className="pb-4 px-3 sm:px-6">
              <CardTitle className="text-xl font-black flex items-center gap-2">
                <span className="text-2xl">🎮</span>
                <span>{t("year-in-review.top-games")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-3 sm:px-6">
              <div className="space-y-4">
                {topGames.slice(0, 5).map((game, index) => (
                  <Link
                    key={game.app_id}
                    href={`/apps/${game.app_id}`}
                    className="block group"
                  >
                    <div className="relative p-4 rounded-xl bg-flathub-gainsborow/30 dark:bg-flathub-dark-gunmetal/30 hover:bg-flathub-gainsborow/50 dark:hover:bg-flathub-dark-gunmetal/50 transition-all">
                      <RankBadge
                        rank={index + 1}
                        size="lg"
                        color="celestial-blue"
                      />
                      <div className="flex items-start gap-4 ms-6">
                        <div className="w-16 h-16 flex-shrink-0">
                          {game.icon && (
                            <LogoImage
                              iconUrl={game.icon}
                              appName={game.name}
                              size="128"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-bold text-flathub-dark-gunmetal dark:text-flathub-gainsborow group-hover:text-flathub-celestial-blue dark:group-hover:text-flathub-celestial-blue transition-colors">
                            {game.name}
                          </div>
                          <div className="text-sm mt-1 text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70 line-clamp-2 min-h-[2.5rem]">
                            {game.summary}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="text-sm font-semibold text-flathub-celestial-blue dark:text-flathub-celestial-blue">
                              {new Intl.NumberFormat(locale, {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }).format(game.downloads)}
                            </div>
                            <div className="text-xs text-flathub-dark-gunmetal/60 dark:text-flathub-gainsborow/80">
                              {t("downloads")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {(topEmulators?.length > 0 ||
        topGameStores?.length > 0 ||
        topGameUtilities?.length > 0) && (
        <div className="grid lg:grid-cols-3 gap-6 pt-6">
          {[
            {
              data: topEmulators,
              title: t("emulators"),
              icon: "🕹️",
              color: "celestial-blue",
            },
            {
              data: topGameStores,
              title: t("year-in-review.game-stores"),
              icon: "🏪",
              color: "celestial-blue",
            },
            {
              data: topGameUtilities,
              title: t("year-in-review.game-utilities"),
              icon: "🔧",
              color: "celestial-blue",
            },
          ]
            .filter((section) => section.data && section.data.length > 0)
            .map((section, sidx) => (
              <Card
                key={sidx}
                className="bg-white dark:bg-flathub-arsenic border-0 lg:border border-flathub-gainsborow/40 dark:border-flathub-dark-gunmetal shadow-xl"
              >
                <CardHeader className="pb-3 px-3 sm:px-6">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <span className="text-xl">{section.icon}</span>
                    <span>{section.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-3 sm:px-6">
                  <div className="space-y-3">
                    {section.data.slice(0, 3).map((app, index) => (
                      <Link
                        key={app.app_id}
                        href={`/apps/${app.app_id}`}
                        className="block group"
                      >
                        <div className="relative p-4 rounded-xl bg-flathub-gainsborow/30 dark:bg-flathub-dark-gunmetal/30 hover:bg-flathub-gainsborow/50 dark:hover:bg-flathub-dark-gunmetal/50 transition-all">
                          <RankBadge
                            rank={index + 1}
                            size="md"
                            color="celestial-blue"
                          />
                          <div className="flex items-start gap-4 ms-6">
                            <div className="w-16 h-16 flex-shrink-0">
                              {app.icon && (
                                <LogoImage
                                  iconUrl={app.icon}
                                  appName={app.name}
                                  size="128"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-lg font-bold text-flathub-dark-gunmetal dark:text-flathub-gainsborow group-hover:text-flathub-celestial-blue dark:group-hover:text-flathub-celestial-blue transition-colors">
                                {app.name}
                              </div>
                              <div className="text-sm mt-1 text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70 line-clamp-2 min-h-[2.5rem]">
                                {app.summary}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="text-sm font-semibold text-flathub-celestial-blue dark:text-flathub-celestial-blue">
                                  {new Intl.NumberFormat(locale, {
                                    notation: "compact",
                                    maximumFractionDigits: 1,
                                  }).format(app.downloads)}
                                </div>
                                <div className="text-xs text-flathub-dark-gunmetal/60 dark:text-flathub-gainsborow/80">
                                  {t("downloads")}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </>
  )
}

export function GeographicInsightsSection({
  geographicStats,
}: {
  geographicStats: YearInReviewGeographicStats
}) {
  const t = useTranslations()
  const locale = useLocale()
  const regionDisplay = useMemo(
    () => new Intl.DisplayNames([locale || "en"], { type: "region" }),
    [locale],
  )

  if (!geographicStats) {
    return null
  }

  return (
    <Card className="bg-white dark:bg-flathub-arsenic border-0 lg:border border-flathub-gainsborow/40 dark:border-flathub-dark-gunmetal shadow-xl">
      <CardHeader className="pb-4 px-3 sm:px-6">
        <CardTitle className="text-xl font-black flex items-center gap-2">
          <span className="text-2xl">🌍</span>
          <span>{t("year-in-review.geographic-insights")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-3 sm:px-6">
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-flathub-gainsborow/30 dark:bg-flathub-dark-gunmetal/30">
            <div className="text-xs font-bold text-flathub-celestial-blue uppercase tracking-wide mb-0.5">
              {t("year-in-review.countries-reached")}
            </div>
            <div className="text-2xl font-black text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
              {geographicStats.total_countries}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Fastest Growing Regions */}
          {geographicStats.fastest_growing_regions &&
            geographicStats.fastest_growing_regions.length > 0 && (
              <div>
                <div className="text-xs font-bold text-flathub-dark-gunmetal/80 dark:text-flathub-gainsborow mb-2 uppercase tracking-wider">
                  {t("year-in-review.fastest-growing-regions")}
                </div>
                <div className="grid gap-1.5">
                  {geographicStats.fastest_growing_regions.map(
                    (region, idx) => {
                      const countryName =
                        regionDisplay.of(region.country_code) ||
                        region.country_code
                      return (
                        <div
                          key={region.country_code}
                          className="flex items-center gap-2 p-2 rounded-lg bg-flathub-gainsborow/30 dark:bg-flathub-dark-gunmetal/30"
                        >
                          <RankBadge
                            rank={idx + 1}
                            size="sm"
                            color="celestial-blue"
                            variant="inline"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs truncate">
                              {countryName}
                            </div>
                          </div>
                          <div className="text-xs font-bold text-flathub-status-green dark:text-flathub-status-green-dark">
                            +{region.growth_percentage}%
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              </div>
            )}

          {/* Top Countries */}
          {geographicStats.top_countries && (
            <div>
              <div className="text-xs font-bold text-flathub-dark-gunmetal/80 dark:text-flathub-gainsborow mb-2 uppercase tracking-wider">
                {t("year-in-review.top-countries")}
              </div>
              <div className="grid gap-1.5">
                {geographicStats.top_countries
                  .slice(0, 5)
                  .map((country, idx) => {
                    const countryName =
                      regionDisplay.of(country.country_code) ||
                      country.country_code
                    return (
                      <div
                        key={country.country_code}
                        className="flex items-center gap-2 p-2 rounded-lg bg-flathub-gainsborow/30 dark:bg-flathub-dark-gunmetal/30"
                      >
                        <RankBadge
                          rank={idx + 1}
                          size="sm"
                          color="celestial-blue"
                          variant="inline"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs truncate">
                            {countryName}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-flathub-celestial-blue">
                          {new Intl.NumberFormat(locale, {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(country.downloads)}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function CategoryHighlightsSection({
  categoriesData,
}: {
  categoriesData: {
    category: string
    category_name: string
    winners: CategoryAppWinner[]
  }[]
}) {
  const t = useTranslations()
  const locale = useLocale()

  if (!categoriesData || categoriesData.length === 0) {
    return null
  }

  return (
    <div className="space-y-10">
      <div className="text-center space-y-6 mb-12">
        <h3 className="text-2xl sm:text-3xl font-black text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
          {t("year-in-review.category-highlights")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/70 dark:from-blue-900/30 dark:to-blue-800/20 border lg:border-2 border-blue-200/80 dark:border-blue-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🏆</span>
              <div className="flex-1">
                <div className="font-black text-sm text-blue-900 dark:text-blue-200 mb-1.5">
                  {t("year-in-review.most-popular")}
                </div>
                <div className="text-xs text-blue-800/70 dark:text-blue-300/70 leading-relaxed">
                  {t("year-in-review.most-popular-description")}
                </div>
              </div>
            </div>
          </div>
          <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/70 dark:from-purple-900/30 dark:to-purple-800/20 border lg:border-2 border-purple-200/80 dark:border-purple-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-3">
              <span className="text-3xl">📈</span>
              <div className="flex-1">
                <div className="font-black text-sm text-purple-900 dark:text-purple-200 mb-1.5">
                  {t("year-in-review.biggest-growth")}
                </div>
                <div className="text-xs text-purple-800/70 dark:text-purple-300/70 leading-relaxed">
                  {t("year-in-review.biggest-growth-description")}
                </div>
              </div>
            </div>
          </div>
          <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/70 dark:from-amber-900/30 dark:to-amber-800/20 border lg:border-2 border-amber-200/80 dark:border-amber-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-3">
              <span className="text-3xl">✨</span>
              <div className="flex-1">
                <div className="font-black text-sm text-amber-900 dark:text-amber-200 mb-1.5">
                  {t("year-in-review.newcomer-of-year")}
                </div>
                <div className="text-xs text-amber-800/70 dark:text-amber-300/70 leading-relaxed">
                  {t("year-in-review.newcomer-description")}
                </div>
              </div>
            </div>
          </div>
          <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/70 dark:from-emerald-900/30 dark:to-emerald-800/20 border lg:border-2 border-emerald-200/80 dark:border-emerald-700/50 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🏅</span>
              <div className="flex-1">
                <div className="font-black text-sm text-emerald-900 dark:text-emerald-200 mb-1.5">
                  {t("year-in-review.most-improved")}
                </div>
                <div className="text-xs text-emerald-800/70 dark:text-emerald-300/70 leading-relaxed">
                  {t("year-in-review.most-improved-description")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-10">
        {categoriesData.map((cat) => (
          <div
            key={cat.category}
            className="p-4 sm:p-8 rounded-2xl bg-white dark:bg-flathub-arsenic border lg:border-2 border-flathub-gainsborow/40 dark:border-flathub-dark-gunmetal shadow-xl"
          >
            <div>
              <h4 className="text-xl lg:text-2xl font-black mb-8 text-flathub-dark-gunmetal dark:text-flathub-gainsborow pb-4 ps-4 relative border-b lg:border-b-2 border-transparent">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-gradient-to-r from-flathub-celestial-blue via-purple-500 to-flathub-sunset-pink rtl:bg-gradient-to-l shadow-[0_0_10px_rgba(33,150,243,0.3)]"
                />
                {cat.category_name}
              </h4>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {cat.winners.map((winner) => (
                  <Link
                    key={winner.app_id}
                    href={`/apps/${winner.app_id}`}
                    className="group block"
                  >
                    <div className="p-5 rounded-xl bg-gradient-to-br from-white/90 to-flathub-lotion/60 dark:from-flathub-dark-gunmetal/70 dark:to-flathub-dark-gunmetal/50 hover:from-white dark:hover:from-flathub-dark-gunmetal/90 dark:hover:to-flathub-dark-gunmetal/70 border lg:border-2 border-flathub-gainsborow/60 dark:border-flathub-arsenic/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl h-full flex flex-col backdrop-blur-sm hover:border-flathub-celestial-blue/50 dark:hover:border-flathub-celestial-blue/40">
                      {/* Award badges */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {winner.awards.map((award, aidx) => {
                          const types = {
                            popular: {
                              label: t("year-in-review.most-popular"),
                              icon: "🏆",
                              bgColor: "bg-blue-100 dark:bg-blue-900/40",
                              textColor: "text-blue-800 dark:text-blue-200",
                            },
                            growth: {
                              label: t("year-in-review.biggest-growth"),
                              icon: "📈",
                              bgColor: "bg-purple-100 dark:bg-purple-900/40",
                              textColor: "text-purple-800 dark:text-purple-200",
                            },
                            newcomer: {
                              label: t("year-in-review.newcomer-of-year"),
                              icon: "✨",
                              bgColor: "bg-amber-100 dark:bg-amber-900/40",
                              textColor: "text-amber-800 dark:text-amber-200",
                            },
                            improved: {
                              label: t("year-in-review.most-improved"),
                              icon: "🏅",
                              bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
                              textColor:
                                "text-emerald-800 dark:text-emerald-200",
                            },
                          }
                          const config = types[award.type]
                          return (
                            <div
                              key={aidx}
                              className={clsx(
                                "text-[9px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm",
                                config.bgColor,
                                config.textColor,
                              )}
                            >
                              <span>{config.icon}</span> {config.label}
                            </div>
                          )
                        })}
                      </div>

                      {/* App info */}
                      <div className="flex items-start gap-3 mb-4">
                        {winner.icon && (
                          <LogoImage
                            iconUrl={winner.icon}
                            appName={winner.name}
                            size="64"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-base text-flathub-dark-gunmetal dark:text-flathub-gainsborow group-hover:text-flathub-celestial-blue dark:group-hover:text-flathub-celestial-blue transition-colors line-clamp-2 mb-1.5">
                            {winner.name}
                          </div>
                          <div className="text-xs text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70 line-clamp-2 leading-relaxed">
                            {winner.summary}
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="mt-auto flex flex-wrap gap-2">
                        {winner.awards.map((award, aidx) => {
                          let text = ""
                          let bgColor = ""
                          let textColor = ""

                          if (award.type === "popular") {
                            const downloadsCount = new Intl.NumberFormat(
                              locale,
                              {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              },
                            ).format(
                              (award.data as YearInReviewCategoryApp).downloads,
                            )
                            text = t("x-downloads", {
                              x: downloadsCount,
                            })
                            bgColor = "bg-blue-100/80 dark:bg-blue-900/40"
                            textColor = "text-blue-800 dark:text-blue-200"
                          } else if (award.type === "growth") {
                            text = t("year-in-review.x-growth", {
                              percentage: (
                                award.data as YearInReviewCategoryGrowthApp
                              ).growth_percentage,
                            })
                            bgColor = "bg-purple-100/80 dark:bg-purple-900/40"
                            textColor = "text-purple-800 dark:text-purple-200"
                          } else if (award.type === "newcomer") {
                            const downloadsCount = new Intl.NumberFormat(
                              locale,
                              {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              },
                            ).format(
                              (award.data as YearInReviewCategoryApp).downloads,
                            )
                            text = t("x-downloads", {
                              x: downloadsCount,
                            })
                            bgColor = "bg-amber-100/80 dark:bg-amber-900/40"
                            textColor = "text-amber-800 dark:text-amber-200"
                          } else {
                            text = t("year-in-review.x-growth", {
                              percentage: (
                                award.data as YearInReviewCategoryGrowthApp
                              ).growth_percentage,
                            })
                            bgColor = "bg-emerald-100/80 dark:bg-emerald-900/40"
                            textColor = "text-emerald-800 dark:text-emerald-200"
                          }

                          return (
                            <div
                              key={aidx}
                              className={clsx(
                                "text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm",
                                bgColor,
                                textColor,
                              )}
                            >
                              {text}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HiddenGemsSection({ hiddenGems }: { hiddenGems: HiddenGem[] }) {
  const t = useTranslations()
  const locale = useLocale()

  if (!hiddenGems || hiddenGems.length === 0) {
    return null
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 border-0 lg:border border-purple-200/50 dark:border-purple-800/30 shadow-xl h-full">
      <CardHeader className="pb-4 px-3 sm:px-6">
        <CardTitle className="text-xl font-black flex items-center gap-2">
          <span className="text-2xl">💎</span>
          <span>{t("year-in-review.hidden-gems")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-3 sm:px-6">
        <p className="text-xs text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70 mb-4 font-medium">
          {t("year-in-review.hidden-gems-description")}
        </p>
        <div className="grid gap-3">
          {hiddenGems.map((gem, idx) => (
            <Link
              key={gem.app_id}
              href={`/apps/${gem.app_id}`}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-white/70 dark:bg-flathub-dark-gunmetal/40 hover:bg-white dark:hover:bg-flathub-dark-gunmetal/60 transition-all group border lg:border-2 border-purple-200/60 dark:border-purple-800/30 hover:shadow-lg hover:scale-[1.01]"
            >
              {gem.icon && (
                <LogoImage iconUrl={gem.icon} appName={gem.name} size="64" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm text-flathub-dark-gunmetal dark:text-flathub-gainsborow truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 dark:group-hover:from-purple-400 dark:group-hover:to-pink-400 transition-all">
                  {gem.name}
                </div>
                <div className="text-[11px] text-flathub-dark-gunmetal/60 dark:text-flathub-gainsborow/60 line-clamp-1 mb-1.5">
                  {gem.summary}
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 shadow-sm">
                  {new Intl.NumberFormat(locale, {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(gem.downloads)}{" "}
                  {t("downloads")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function PlatformDiversitySection({
  platformStats,
}: {
  platformStats: PlatformStats[]
}) {
  const t = useTranslations()
  const locale = useLocale()

  if (!platformStats || platformStats.length === 0) {
    return null
  }

  return (
    <Card className="bg-white dark:bg-flathub-arsenic border-0 lg:border border-flathub-gainsborow/40 dark:border-flathub-dark-gunmetal shadow-xl">
      <CardHeader className="pb-4 px-3 sm:px-6">
        <CardTitle className="text-xl font-black flex items-center gap-2">
          <span className="text-2xl">💻</span>
          <span>{t("year-in-review.platform-downloads")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-3 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {platformStats.map((plat) => (
            <div
              key={plat.architecture}
              className="relative p-4 rounded-xl bg-gradient-to-br from-flathub-gainsborow/20 to-flathub-gainsborow/40 dark:from-flathub-dark-gunmetal/20 dark:to-flathub-dark-gunmetal/40 border-0 lg:border border-flathub-gainsborow/50 dark:border-flathub-dark-gunmetal/50 hover:shadow-lg transition-shadow"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-flathub-celestial-blue/5 via-purple-500/5 to-transparent pointer-events-none rounded-xl" />
              <div className="relative z-10">
                <div className="text-xs font-bold text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70 mb-2 uppercase tracking-wider">
                  {plat.architecture.toUpperCase()}
                </div>
                <div className="text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-flathub-celestial-blue via-purple-500 to-flathub-sunset-pink mb-1">
                  {plat.percentage.toFixed(1)}%
                </div>
                <div className="text-xs font-bold text-flathub-dark-gunmetal/60 dark:text-flathub-gainsborow/60">
                  {new Intl.NumberFormat(locale, {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(plat.downloads)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function TrendingCategoriesSection({
  trendingCategories,
  getCategoryDisplayName,
  year,
}: {
  trendingCategories: TrendingCategory[]
  getCategoryDisplayName: (c: string) => string
  year: number
}) {
  const t = useTranslations()
  const locale = useLocale()

  if (!trendingCategories || trendingCategories.length === 0) {
    return null
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20 border-0 lg:border border-blue-200/50 dark:border-blue-800/30 shadow-xl">
      <CardHeader className="pb-4 px-3 sm:px-6">
        <CardTitle className="text-xl font-black flex items-center gap-2">
          <span className="text-2xl">🚀</span>
          <span>{t("year-in-review.trending-categories")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-3 sm:px-6">
        <p className="text-xs text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70 mb-4 font-medium">
          {t("year-in-review.trending-categories-description")}
        </p>
        <div className="space-y-4">
          {trendingCategories.map((cat) => {
            const maxValue = Math.max(
              cat.current_year_downloads,
              cat.previous_year_downloads,
            )
            const currentWidth = (cat.current_year_downloads / maxValue) * 100
            const previousWidth = (cat.previous_year_downloads / maxValue) * 100

            return (
              <div
                key={cat.category}
                className="p-5 rounded-xl bg-white/60 dark:bg-flathub-dark-gunmetal/30 border lg:border-2 border-blue-200/60 dark:border-blue-800/30 hover:shadow-lg transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="font-black text-base text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
                    {getCategoryDisplayName(cat.category)}
                  </div>
                  <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-500 dark:from-emerald-400 dark:to-green-300">
                    +{cat.growth_percentage.toFixed(0)}%
                  </div>
                </div>

                <div className="space-y-2.5">
                  {/* Current year bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70">
                        {year}
                      </span>
                      <span className="font-black text-flathub-celestial-blue dark:text-flathub-celestial-blue">
                        {new Intl.NumberFormat(locale, {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(cat.current_year_downloads)}
                      </span>
                    </div>
                    <div className="h-3 bg-flathub-gainsborow/40 dark:bg-black/40 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-flathub-celestial-blue to-blue-400 dark:from-flathub-celestial-blue dark:to-blue-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(33,150,243,0.4)]"
                        style={{ width: `${currentWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Previous year bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70">
                        {year - 1}
                      </span>
                      <span className="font-black text-flathub-dark-gunmetal/50 dark:text-flathub-gainsborow/50">
                        {new Intl.NumberFormat(locale, {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(cat.previous_year_downloads)}
                      </span>
                    </div>
                    <div className="h-3 bg-flathub-gainsborow/40 dark:bg-black/40 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-flathub-dark-gunmetal/40 dark:bg-flathub-gainsborow/25 rounded-full transition-all duration-500"
                        style={{ width: `${previousWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function YearInReview({
  year,
  totalDownloads,
  newAppsCount,
  totalApps,
  updatesCount,
  totalDownloadsChange,
  totalDownloadsChangePercentage,
  hasPreviousYear = true,
  topApps,
  topGames,
  topEmulators,
  topGameStores,
  topGameUtilities,
  biggestGrowthByCategory,
  newcomersByCategory,
  mostImprovedByCategory,
  popularAppsByCategory,
  geographicStats,
  hiddenGems,
  trendingCategories,
  platformStats,
  hasGeographicData = true,
}: YearInReviewProps) {
  const t = useTranslations()

  const getCategoryDisplayName = useCallback(
    (category: string): string => {
      const mainCategory = stringToCategory(category)
      return mainCategory ? categoryToName(mainCategory, t) : category
    },
    [t],
  )

  const filteredPlatformStats = useMemo(() => {
    if (!platformStats) return undefined
    return platformStats.filter(
      (stat) =>
        stat.architecture.toLowerCase() !== "i386" &&
        stat.architecture.toLowerCase() !== "arm",
    )
  }, [platformStats])

  const categoriesData = useMemo(() => {
    const categoryMap = new Map<string, CategoryAppWinner[]>()

    const addWinner = (
      category: string,
      app: YearInReviewCategoryApp | YearInReviewCategoryGrowthApp,
      awardType: Award["type"],
    ) => {
      if (!categoryMap.has(category)) {
        categoryMap.set(category, [])
      }
      const winners = categoryMap.get(category)!
      const existingWinner = winners.find((w) => w.app_id === app.app_id)

      if (existingWinner) {
        existingWinner.awards.push({ type: awardType, data: app })
      } else {
        winners.push({
          app_id: app.app_id,
          name: app.name,
          icon: app.icon,
          summary: app.summary,
          awards: [{ type: awardType, data: app }],
        })
      }
    }

    popularAppsByCategory?.forEach((app) =>
      addWinner(app.category, app, "popular"),
    )
    biggestGrowthByCategory?.forEach((app) =>
      addWinner(app.category, app, "growth"),
    )
    newcomersByCategory?.forEach((app) =>
      addWinner(app.category, app, "newcomer"),
    )
    mostImprovedByCategory?.forEach((app) =>
      addWinner(app.category, app, "improved"),
    )

    return Array.from(categoryMap.entries())
      .map(([category, winners]) => ({
        category,
        category_name: getCategoryDisplayName(category),
        winners,
      }))
      .sort((a, b) => {
        const aCat = stringToCategory(a.category)
        const bCat = stringToCategory(b.category)

        const aIndex =
          aCat && categoryOrder.includes(aCat)
            ? categoryOrder.indexOf(aCat)
            : categoryOrder.length + 1
        const bIndex =
          bCat && categoryOrder.includes(bCat)
            ? categoryOrder.indexOf(bCat)
            : categoryOrder.length + 1

        if (aIndex === bIndex) {
          return a.category.localeCompare(b.category)
        }
        return aIndex - bIndex
      })
  }, [
    popularAppsByCategory,
    biggestGrowthByCategory,
    newcomersByCategory,
    mostImprovedByCategory,
    getCategoryDisplayName,
  ])

  return (
    <div
      className={clsx(
        "rounded-3xl overflow-hidden shadow-2xl backdrop-blur-lg border lg:border-2 border-white/30 dark:border-white/10 relative",
        "bg-gradient-to-br from-slate-50/95 via-blue-50/40 to-purple-50/40",
        "dark:from-slate-900/95 dark:via-blue-950/60 dark:to-purple-950/60",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-flathub-celestial-blue via-purple-500 to-flathub-vivid-crimson" />

      <div className="p-4 sm:p-8 lg:p-16">
        {/* Header Section */}
        <header className="text-center mb-16 relative">
          <Link
            href={`/year-in-review/${year}`}
            className="inline-block group relative"
          >
            <h2 className="text-5xl lg:text-7xl font-black mb-4 tracking-tighter bg-gradient-to-r from-flathub-celestial-blue via-flathub-vivid-crimson to-flathub-celestial-blue bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient group-hover:scale-105 transition-transform duration-500">
              {t("year-in-review.title", { year })}
            </h2>
            <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-flathub-celestial-blue to-flathub-sunset-pink transition-all duration-500 mx-auto rounded-full shadow-[0_0_15px_rgba(33,150,243,0.5)]" />
          </Link>
          <p className="text-lg lg:text-xl font-medium text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70 max-w-3xl mx-auto mt-6 leading-relaxed">
            {t("year-in-review.description")}
          </p>
        </header>

        {/* Global Overview Section */}
        <section className="mb-20">
          <YearStatsGrid
            year={year}
            totalDownloads={totalDownloads}
            newAppsCount={newAppsCount}
            totalApps={totalApps}
            updatesCount={updatesCount}
            totalDownloadsChange={totalDownloadsChange}
            totalDownloadsChangePercentage={totalDownloadsChangePercentage}
            hasPreviousYear={hasPreviousYear}
          />
        </section>

        {/* Popular Apps Section */}
        <section className="mb-24">
          <TopAppsSection
            topApps={topApps}
            topGames={topGames}
            topEmulators={topEmulators}
            topGameStores={topGameStores}
            topGameUtilities={topGameUtilities}
          />
        </section>

        {/* Geographic Section */}
        {hasGeographicData && geographicStats && (
          <section className="mb-24">
            <GeographicInsightsSection geographicStats={geographicStats} />
          </section>
        )}

        {/* Hidden Gems & Trending Categories - Side by side on desktop, stacked on mobile */}
        {((hiddenGems && hiddenGems.length > 0) ||
          (trendingCategories && trendingCategories.length > 0)) && (
          <section className="mb-24">
            <div className="grid gap-8 lg:grid-cols-2">
              {hiddenGems && hiddenGems.length > 0 && (
                <div>
                  <HiddenGemsSection hiddenGems={hiddenGems} />
                </div>
              )}
              {trendingCategories && trendingCategories.length > 0 && (
                <div>
                  <TrendingCategoriesSection
                    trendingCategories={trendingCategories}
                    getCategoryDisplayName={getCategoryDisplayName}
                    year={year}
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Category Brackets Section */}
        {categoriesData.length > 0 && (
          <section className="mb-24">
            <CategoryHighlightsSection categoriesData={categoriesData} />
          </section>
        )}

        <PlatformDiversitySection platformStats={filteredPlatformStats} />
      </div>
    </div>
  )
}
