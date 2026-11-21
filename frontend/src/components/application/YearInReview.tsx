"use client"

import { useLocale, useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"
import { useState, useMemo, useCallback } from "react"
import { formatDownloadChange } from "src/formatDownloadChange"
import { yearInReviewSpiral } from "src/yearInReviewSpiral"
import {
  ArrowDown,
  ArrowUp,
  Download,
  Layers,
  Percent,
  RefreshCw,
  Sprout,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react"
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
import PopulationSource from "src/components/charts/PopulationSource"
import PopulationToggle from "src/components/charts/PopulationToggle"
import ReactCountryFlag from "react-country-flag"

const categoryOrder: MainCategory[] = [
  MainCategory.office,
  MainCategory.graphics,
  MainCategory.audiovideo,
  MainCategory.education,
  MainCategory.game,
  MainCategory.network,
  MainCategory.development,
  MainCategory.science,
  MainCategory.healthfitness,
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
  previousCharts?: {
    limit: number
    "top-apps": string[]
    "top-games": string[]
  }
  topEmulators: YearInReviewMostPopularApp[]
  topGameStores: YearInReviewMostPopularApp[]
  topGameUtilities: YearInReviewMostPopularApp[]
  popularAppsByCategory?: YearInReviewCategoryApp[]
  biggestGrowthByCategory?: YearInReviewCategoryGrowthApp[]
  newcomersByCategory?: YearInReviewCategoryApp[]
  unavailableAppIds?: string[]
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

export function YearStatsGrid({
  year,
  totalDownloads,
  change,
  delta,
  hasPreviousYear,
  totalApps,
  updatesCount,
}: {
  year: number
  totalDownloads: number
  change: number
  delta: number
  hasPreviousYear: boolean
  totalApps: number
  updatesCount: number
}) {
  const t = useTranslations()
  const locale = useLocale()
  const comparison = formatDownloadChange(locale, delta, change)
  const compact = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  })
  const metrics = [
    ["total-downloads", compact.format(totalDownloads), Download],
    ["total-apps", totalApps.toLocaleString(locale), Layers],
    ["app-updates", compact.format(updatesCount), RefreshCw],
  ] as const
  return (
    <div className="overflow-hidden rounded-b-[18px] border border-t-0 border-[var(--line)] bg-[var(--paper)]">
      <dl className="grid grid-cols-3 divide-x divide-[var(--line)] py-[26px] max-sm:py-4">
        {metrics.map(([key, value, Icon]) => (
          <div
            key={key}
            className="min-w-0 px-[clamp(12px,2.5vw,40px)] wrap-anywhere"
          >
            <dt className="flex items-center gap-2 text-sm font-semibold text-[var(--subtle)] max-sm:block max-sm:text-[13px] max-sm:hyphens-auto">
              <Icon
                className="shrink-0 max-sm:mb-1"
                size={17}
                aria-hidden="true"
              />
              {t(`year-in-review.${key}`)}
            </dt>
            <dd className="mt-2 text-[clamp(36px,3.5vw,56px)] leading-[1.1] font-[760] tracking-[-.055em] max-sm:text-[clamp(21px,5vw,32px)]">
              {value}
              {key === "total-downloads" &&
                hasPreviousYear &&
                comparison !== null && (
                  <small className="mt-1.5 block text-[13px] leading-snug font-medium tracking-normal text-[var(--subtle)]">
                    {t("year-in-review.downloads-vs-previous-year", {
                      year: year - 1,
                    })}
                    : {comparison}
                  </small>
                )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function TopAppsSection({
  year,
  topApps,
  topGames,
  previousCharts,
  topEmulators,
  topGameStores,
  topGameUtilities,
}: {
  year: number
  topApps: YearInReviewMostPopularApp[]
  topGames: YearInReviewMostPopularApp[]
  previousCharts?: YearInReviewProps["previousCharts"]
  topEmulators: YearInReviewMostPopularApp[]
  topGameStores: YearInReviewMostPopularApp[]
  topGameUtilities: YearInReviewMostPopularApp[]
}) {
  const t = useTranslations()
  const locale = useLocale()

  function rankChange(chart: string, id: string, index: number) {
    if (!previousCharts || (chart !== "top-apps" && chart !== "top-games")) {
      return null
    }
    const prior = previousCharts[chart].indexOf(id)
    const outsideTopTen = prior < 0
    if (prior === index || (outsideTopTen && previousCharts.limit < 10)) {
      return null
    }
    const movedUp = prior > index
    const Icon = outsideTopTen ? Star : movedUp ? ArrowUp : ArrowDown
    const label = outsideTopTen
      ? t("year-in-review.outside-previous-top-ten")
      : t("year-in-review.previous-rank", { rank: prior + 1, year: year - 1 })
    return (
      <span
        title={label}
        className={clsx(
          "inline-flex items-center justify-center gap-0.5 rounded px-1 py-0.5 text-[11px] leading-none font-bold tabular-nums",
          outsideTopTen
            ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
            : movedUp
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
        )}
      >
        <Icon size={12} strokeWidth={2.5} aria-hidden />
        {!outsideTopTen && (
          <span aria-hidden>
            {Math.abs(prior - index).toLocaleString(locale)}
          </span>
        )}
        <span className="sr-only">{label}</span>
      </span>
    )
  }

  const groups = [
    [
      [topApps, "top-apps"],
      [topGames, "top-games"],
    ],
    [
      [topEmulators, "top-emulators"],
      [topGameStores, "top-game-stores"],
      [topGameUtilities, "top-game-utilities"],
    ],
  ] as const
  return (
    <>
      {groups.map((group, groupIndex) => {
        const limit = groupIndex === 0 ? 5 : 3
        return (
          group.some((entry) => entry[0]?.length) && (
            <div
              key={groupIndex}
              className={
                groupIndex === 0
                  ? "grid gap-7 md:grid-cols-2"
                  : "mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5"
              }
            >
              {group.map(
                ([apps, key]) =>
                  apps?.length > 0 && (
                    <section
                      key={key}
                      className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]"
                    >
                      <h2
                        className={clsx(
                          "border-b border-[var(--line)] px-[22px] py-[18px] font-[750] tracking-[-.045em] dark:bg-muted/30 print:bg-white",
                          groupIndex === 0 ? "text-[26px]" : "text-[21px]",
                        )}
                      >
                        {t(`year-in-review.${key}`)}
                      </h2>
                      <ol className="divide-y divide-[var(--line)]">
                        {apps.slice(0, limit).map((app, index) => (
                          <li key={app.app_id}>
                            <Link
                              className={clsx(
                                "grid items-center text-inherit hover:bg-accent",
                                groupIndex === 0
                                  ? "grid-cols-[32px_44px_minmax(0,1fr)_auto] gap-3 px-5 py-4 max-sm:grid-cols-[32px_36px_minmax(0,1fr)_auto] max-sm:gap-2 max-sm:px-3"
                                  : "grid-cols-[20px_34px_minmax(0,1fr)_auto] gap-2 p-3",
                              )}
                              href={`/apps/${app.app_id}`}
                            >
                              <span className="flex flex-col items-center gap-1 text-sm font-semibold tabular-nums text-[var(--subtle)]">
                                {(index + 1).toLocaleString(locale, {
                                  minimumIntegerDigits: 2,
                                })}
                                {rankChange(key, app.app_id, index)}
                              </span>
                              <div>
                                {app.icon && (
                                  <LogoImage
                                    iconUrl={app.icon}
                                    appName={app.name}
                                    size={64}
                                  />
                                )}
                              </div>
                              <div>
                                <strong className="text-[17px] wrap-anywhere">
                                  {app.name}
                                </strong>
                                <small className="block truncate text-[13px] text-[var(--subtle)]">
                                  {app.summary}
                                </small>
                              </div>
                              <div className="text-end font-semibold">
                                {new Intl.NumberFormat(locale, {
                                  notation: "compact",
                                  maximumFractionDigits: 1,
                                }).format(app.downloads)}
                                <small className="block text-[11px] font-normal text-[var(--subtle)]">
                                  {t("downloads")}
                                </small>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ),
              )}
            </div>
          )
        )
      })}
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
  const [normalizePopulation, setNormalizePopulation] = useState(false)
  const hasPopulation =
    geographicStats?.top_countries_per_capita != null &&
    geographicStats.population_year != null &&
    geographicStats.population_revision != null
  const perCapita = normalizePopulation && hasPopulation
  const topCountries = perCapita
    ? geographicStats.top_countries_per_capita!
    : (geographicStats?.top_countries ?? [])

  if (!geographicStats) {
    return null
  }

  return (
    <Card className="gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-none">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-xl font-black flex items-center gap-2">
          <h2 className="flex items-center gap-2">
            <span>{t("year-in-review.geographic-insights")}</span>
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-2 text-sm text-foreground/70">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {new Intl.NumberFormat(locale).format(
                geographicStats.total_countries,
              )}
            </span>
            <span>{t("year-in-review.countries-reached")}</span>
          </div>
          <PopulationToggle
            checked={perCapita}
            onCheckedChange={setNormalizePopulation}
            disabled={!hasPopulation}
          />
        </div>

        {/* Share the heading, column labels, and five ranked rows on desktop. */}
        <div className="grid gap-7 lg:grid-cols-2 lg:grid-rows-[repeat(7,auto)] lg:gap-x-10 lg:gap-y-0">
          {/* Fastest Growing Regions */}
          {geographicStats.fastest_growing_regions &&
            geographicStats.fastest_growing_regions.length > 0 && (
              <div className="order-2 min-w-0 lg:row-span-full lg:grid lg:grid-rows-subgrid">
                <h3 className="mb-3 text-sm font-semibold">
                  {t("year-in-review.fastest-growing-regions")}
                </h3>
                <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 text-xs text-foreground/70">
                  <span>{t("country-downloads.country")}</span>
                  <span className="text-end">
                    {t("year-in-review.annual-growth")}
                  </span>
                </div>
                <div
                  className="lg:row-span-5 lg:grid lg:grid-rows-subgrid"
                  role="list"
                  aria-label={t("year-in-review.fastest-growing-regions")}
                >
                  {geographicStats.fastest_growing_regions.map(
                    (region, idx) => {
                      const countryName =
                        regionDisplay.of(region.country_code) ||
                        region.country_code
                      return (
                        <div
                          key={region.country_code}
                          role="listitem"
                          className="flex items-center gap-3 border-b border-border/50 py-3.5 last:border-0"
                        >
                          <span className="w-3 text-xs tabular-nums text-foreground/70">
                            {idx + 1}.
                          </span>
                          <ReactCountryFlag
                            countryCode={region.country_code}
                            aria-hidden="true"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">{countryName}</div>
                          </div>
                          <div className="ms-auto text-end text-sm font-semibold tabular-nums text-[color-mix(in_oklab,oklch(var(--flathub-status-green)),oklch(var(--foreground))_45%)]">
                            {new Intl.NumberFormat(locale, {
                              style: "percent",
                              signDisplay: "always",
                            }).format(region.growth_percentage / 100)}
                            <small className="block text-end font-normal text-[var(--subtle)]">
                              {t("year-in-review.more-downloads", {
                                count: region.growth,
                              })}
                            </small>
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
            <div className="order-1 min-w-0 lg:row-span-full lg:grid lg:grid-rows-subgrid">
              <h3 className="mb-3 text-sm font-semibold">
                {t("year-in-review.top-countries")}
              </h3>
              <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 text-xs text-foreground/70">
                <span>{t("country-downloads.country")}</span>
                <span className="text-end">
                  {t(
                    perCapita
                      ? "country-downloads.per-100000"
                      : "country-downloads.total-downloads",
                  )}
                </span>
              </div>
              <div
                className="lg:row-span-5 lg:grid lg:grid-rows-subgrid"
                role="list"
                aria-label={t("year-in-review.top-countries")}
              >
                {topCountries.slice(0, 5).map((country, idx) => {
                  const countryName =
                    regionDisplay.of(country.country_code) ||
                    country.country_code
                  return (
                    <div
                      key={country.country_code}
                      role="listitem"
                      className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/50 py-3.5 last:border-0"
                    >
                      <span className="text-xs tabular-nums text-foreground/70">
                        {idx + 1}.
                      </span>
                      <div className="flex min-w-0 items-center gap-2">
                        <ReactCountryFlag
                          countryCode={country.country_code}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 text-sm">{countryName}</div>
                      </div>
                      <div className="text-end text-base font-semibold tabular-nums">
                        {perCapita &&
                        "downloads_per_100000" in country &&
                        typeof country.downloads_per_100000 === "number" ? (
                          <>
                            <div>
                              {new Intl.NumberFormat(locale, {
                                maximumFractionDigits: 2,
                              }).format(country.downloads_per_100000)}
                              <span className="sr-only">
                                {" "}
                                {t("country-downloads.per-100000")}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs font-normal text-foreground/70">
                              {t("country-downloads.x-total", {
                                x: new Intl.NumberFormat(locale).format(
                                  country.downloads,
                                ),
                              })}
                            </div>
                          </>
                        ) : (
                          new Intl.NumberFormat(locale, {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(country.downloads)
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-t border-border/60 pt-3">
          <p className="m-0 text-xs text-foreground/70">
            {t("country-downloads.summary")}
          </p>
          {perCapita && (
            <PopulationSource
              year={geographicStats.population_year!}
              revision={geographicStats.population_revision!}
            >
              <p>{t("year-in-review.per-capita-description")}</p>
            </PopulationSource>
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

  const [picked, setPicked] = useState("")
  if (!categoriesData || categoriesData.length === 0) {
    return null
  }

  const labels = {
    popular: "most-popular",
    growth: "biggest-growth",
    newcomer: "newcomer-of-year",
    improved: "most-improved",
  } as const
  const active =
    picked === "all"
      ? "all"
      : (
          categoriesData.find((cat) => cat.category === picked) ??
          categoriesData[0]
        ).category
  const awardIcons = {
    popular: Trophy,
    growth: TrendingUp,
    improved: Percent,
    newcomer: Sprout,
  }
  const definitions = [
    ["popular", "most-popular-description"],
    ["growth", "biggest-growth-description"],
    ["newcomer", "newcomer-description"],
    ["improved", "most-improved-description"],
  ] as const
  const compact = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  })
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "always",
  })
  const pickerButton =
    "cursor-pointer rounded-md px-3 py-[7px] text-start hover:underline aria-pressed:bg-secondary aria-pressed:text-secondary-foreground aria-pressed:font-semibold"
  const awardLabel =
    "flex items-center gap-1.5 [&_svg]:shrink-0 [&_svg]:text-[var(--chart-1)]"
  return (
    <section className="min-w-0 rounded-2xl bg-[linear-gradient(120deg,color-mix(in_oklab,var(--paper)_80%,var(--chart-1)),color-mix(in_oklab,var(--paper)_86%,var(--chart-4))_72%,color-mix(in_oklab,var(--paper)_88%,var(--chart-7)))] p-[clamp(16px,2.5vw,32px)] [--divider:color-mix(in_srgb,currentColor_22%,transparent)] print:bg-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--divider)] pb-[18px]">
        <h2 className="text-[clamp(28px,3vw,42px)] font-[750] tracking-[-.045em]">
          {t("year-in-review.category-highlights")}
        </h2>
        <select
          className="max-w-full rounded-md bg-[var(--paper)] px-3 py-2 font-semibold md:hidden print:hidden"
          aria-label={t("year-in-review.category-highlights")}
          value={active}
          onChange={(event) => setPicked(event.target.value)}
        >
          {categoriesData.map((cat) => (
            <option key={cat.category} value={cat.category}>
              {cat.category_name}
            </option>
          ))}
          <option value="all">{t("year-in-review.all-categories")}</option>
        </select>
      </div>
      <div className="md:grid md:grid-cols-[minmax(180px,1fr)_minmax(0,4fr)] md:gap-6 print:block">
        <div
          className="hidden flex-col gap-0.5 border-e border-[var(--divider)] py-3.5 pe-4 md:flex print:hidden"
          role="group"
          aria-label={t("year-in-review.category-highlights")}
        >
          {categoriesData.map((cat) => (
            <button
              className={pickerButton}
              type="button"
              key={cat.category}
              aria-pressed={cat.category === active}
              onClick={() => setPicked(cat.category)}
            >
              {cat.category_name}
            </button>
          ))}
          <button
            className={clsx(
              pickerButton,
              "mt-2 rounded-t-none border-t border-[var(--divider)]",
            )}
            type="button"
            aria-pressed={active === "all"}
            onClick={() => setPicked("all")}
          >
            {t("year-in-review.all-categories")}
          </button>
        </div>
        <div>
          {categoriesData.map((cat) => {
            const headliner = cat.winners.find((app) =>
              app.awards.some((award) => award.type === "popular"),
            )
            const lineup = headliner
              ? [headliner, ...cat.winners.filter((app) => app !== headliner)]
              : cat.winners
            return (
              <section
                key={cat.category}
                className="py-[clamp(16px,2.5vw,32px)] data-[inactive=true]:hidden print:data-[inactive=true]:block"
                data-inactive={active !== "all" && active !== cat.category}
              >
                <h3
                  className={clsx(
                    "text-[22px] font-bold wrap-anywhere print:break-after-avoid",
                    active !== "all" && "hidden print:block",
                  )}
                >
                  {cat.category_name}
                </h3>
                <ul className="grid gap-5 md:grid-cols-[1.15fr_1fr] max-md:gap-0">
                  {lineup.map((app) => (
                    <li
                      key={app.app_id}
                      className={
                        app === headliner
                          ? "md:row-span-3 print:break-inside-avoid"
                          : "print:break-inside-avoid"
                      }
                    >
                      <Link
                        className={clsx(
                          "group flex text-inherit",
                          app === headliner
                            ? "items-center gap-[clamp(14px,2vw,28px)] py-[clamp(16px,2.4vw,32px)] max-md:pt-1 [&_img]:w-[clamp(64px,8vw,120px)]"
                            : "items-start gap-[18px] border-t border-[var(--divider)] py-3.5 [&_img]:w-[52px] max-md:[&_img]:w-10",
                        )}
                        href={`/apps/${app.app_id}`}
                      >
                        {app.icon && (
                          <LogoImage
                            iconUrl={app.icon}
                            appName={app.name}
                            size={app === headliner ? 128 : 64}
                          />
                        )}
                        <div className="min-w-0 flex-1 wrap-anywhere">
                          <bdi
                            className={clsx(
                              "font-bold group-hover:underline",
                              app === headliner
                                ? "mb-1.5 block text-[clamp(22px,2.5vw,38px)] leading-[1.12] tracking-[-.035em]"
                                : "text-[19px]",
                            )}
                          >
                            {app.name}
                          </bdi>
                          <small className="block text-sm text-[var(--subtle)]">
                            {app.summary}
                          </small>
                          <dl className="mt-2.5 flex flex-wrap gap-x-[26px] gap-y-2">
                            {app.awards.map((award) => {
                              const data = award.data
                              const Icon = awardIcons[award.type]
                              const value =
                                award.type === "growth" && "growth" in data
                                  ? t("year-in-review.more-downloads", {
                                      count: data.growth,
                                    })
                                  : "growth_percentage" in data
                                    ? t("year-in-review.x-growth-formatted", {
                                        percentage: percent.format(
                                          data.growth_percentage / 100,
                                        ),
                                      })
                                    : t("x-downloads", {
                                        x: compact.format(data.downloads),
                                        count: compact.format(data.downloads),
                                      })
                              return (
                                <div key={award.type}>
                                  <dt
                                    className={clsx(
                                      awardLabel,
                                      "text-[13px] font-medium text-[var(--subtle)]",
                                    )}
                                  >
                                    <Icon size={16} aria-hidden="true" />
                                    {t(`year-in-review.${labels[award.type]}`)}
                                  </dt>
                                  <dd className="font-semibold tabular-nums">
                                    {value}
                                  </dd>
                                </div>
                              )
                            })}
                          </dl>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
      <section className="border-t border-[var(--divider)] pt-[18px] text-[var(--subtle)]">
        <h3 className="font-semibold text-card-foreground print:text-black">
          {t("year-in-review.award-guide")}
        </h3>
        <dl className="my-[18px] grid grid-cols-2 gap-[18px] max-md:text-sm md:grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))]">
          {definitions.map(([type, description]) => {
            const Icon = awardIcons[type]
            return (
              <div key={type}>
                <dt className={clsx(awardLabel, "font-semibold")}>
                  <Icon size={16} aria-hidden="true" />
                  {t(`year-in-review.${labels[type]}`)}
                </dt>
                <dd>{t(`year-in-review.${description}`)}</dd>
              </div>
            )
          })}
        </dl>
      </section>
    </section>
  )
}

export function HiddenGemsSection({ hiddenGems }: { hiddenGems: HiddenGem[] }) {
  const t = useTranslations()
  const locale = useLocale()

  if (!hiddenGems || hiddenGems.length === 0) {
    return null
  }

  return (
    <section className="rounded-[18px] bg-[#e7eddf] p-[clamp(20px,3vw,40px)] text-[#213e34] dark:bg-[#2d3930] dark:text-[#e3f0df] print:bg-white print:text-black">
      <h2 className="text-[clamp(32px,3.5vw,49px)] leading-[1.15] font-[750] tracking-[-.045em]">
        {t("year-in-review.hidden-gems")}
      </h2>
      <p className="mt-2 mb-6 max-w-[60ch]">
        {t("year-in-review.hidden-gems-description")}
      </p>
      <ul className="grid gap-5 md:grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] max-md:gap-0">
        {hiddenGems.map((app) => (
          <li className="min-w-0" key={app.app_id}>
            <Link
              href={`/apps/${app.app_id}`}
              className="group flex h-full flex-col items-start gap-2.5 text-inherit max-md:grid max-md:grid-cols-[54px_1fr] max-md:items-center max-md:gap-x-4 max-md:gap-y-0.5 max-md:border-t max-md:border-current/20 max-md:py-3 max-md:data-[has-icon=false]:grid-cols-1 max-md:data-[has-icon=true]:[&>:first-child]:row-span-2 [&_img]:size-[76px] max-md:[&_img]:size-[54px]"
              data-has-icon={Boolean(app.icon)}
            >
              {app.icon && (
                <LogoImage iconUrl={app.icon} appName={app.name} size={96} />
              )}
              <div>
                <bdi className="text-xl font-bold tracking-tight group-hover:underline max-md:text-lg">
                  {app.name}
                </bdi>
                <small className="block text-sm">{app.summary}</small>
              </div>
              <small
                className={clsx(
                  "mt-auto block text-xs",
                  app.icon && "max-md:col-start-2",
                )}
              >
                {t("x-downloads", {
                  x: new Intl.NumberFormat(locale, {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(app.downloads),
                })}
              </small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

const reportPanel =
  "min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-[clamp(16px,2.5vw,32px)]"
const meterStyle =
  "h-3.5 w-full accent-[var(--chart-1)] [&::-webkit-meter-optimum-value]:bg-[var(--chart-1)] dark:[&::-webkit-meter-bar]:border-0 dark:[&::-webkit-meter-bar]:bg-muted"
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
    <section className={reportPanel}>
      <h2 className="text-[clamp(22px,2.5vw,30px)] font-[720] tracking-[-.03em]">
        {t("year-in-review.platform-downloads")}
      </h2>
      <ul>
        {platformStats.map((platform) => (
          <li
            key={platform.architecture}
            className="border-t border-[var(--line)] py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <bdi>{platform.architecture}</bdi>
              <strong>
                {new Intl.NumberFormat(locale, {
                  style: "percent",
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(platform.percentage / 100)}
              </strong>
            </div>
            <meter
              className={meterStyle}
              min={0}
              max={100}
              value={platform.percentage}
              aria-label={platform.architecture}
            />
            <small className="text-sm text-[var(--subtle)]">
              {t("x-downloads", {
                x: new Intl.NumberFormat(locale, {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(platform.downloads),
              })}
            </small>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TrendingCategoriesSection({
  trendingCategories,
  biggestGrowthByCategory,
  unavailableAppIds,
  getCategoryDisplayName,
  year,
}: {
  trendingCategories: TrendingCategory[]
  biggestGrowthByCategory?: YearInReviewCategoryGrowthApp[]
  unavailableAppIds?: string[]
  getCategoryDisplayName: (c: string) => string
  year: number
}) {
  const t = useTranslations()
  const locale = useLocale()

  if (!trendingCategories || trendingCategories.length === 0) {
    return null
  }

  const rows = trendingCategories.map((cat) => ({
    cat,
    leader: biggestGrowthByCategory?.find(
      (app) => app.category === cat.category && app.growth > 0,
    ),
  }))
  const compact = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  })
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "always",
    maximumFractionDigits: 0,
  })
  return (
    <section className={reportPanel}>
      <h2 className="text-[clamp(22px,2.5vw,30px)] font-[720] tracking-[-.03em]">
        {t("year-in-review.trending-categories")}
      </h2>
      <p className="mt-1 mb-4 max-w-[55ch] text-sm text-[var(--subtle)]">
        {t("year-in-review.trending-categories-description")}
      </p>
      <ul>
        {rows.map(({ cat, leader }) => {
          return (
            <li
              key={cat.category}
              className="border-t border-[var(--line)] py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <h3>{getCategoryDisplayName(cat.category)}</h3>
                <strong>{percent.format(cat.growth_percentage / 100)}</strong>
              </div>
              {(
                [
                  [year, cat.current_year_downloads],
                  [year - 1, cat.previous_year_downloads],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="mt-1.5 grid grid-cols-[4ch_minmax(0,1fr)_7ch] items-center gap-3 text-sm text-[var(--subtle)] [&>span:last-child]:text-end"
                >
                  <span>{label}</span>
                  <meter
                    className={clsx(
                      meterStyle,
                      label !== year &&
                        "dark:[&::-webkit-meter-optimum-value]:bg-muted-foreground dark:[&::-moz-meter-bar]:bg-muted-foreground",
                    )}
                    aria-label={String(label)}
                    min={0}
                    max={Math.max(
                      1,
                      cat.current_year_downloads,
                      cat.previous_year_downloads,
                    )}
                    value={value}
                  />
                  <span>{compact.format(value)}</span>
                </div>
              ))}
              {leader && (
                <p className="mt-3 text-sm">
                  {t.rich("year-in-review.category-gain", {
                    app: leader.name,
                    count: leader.growth,
                    link: (text) =>
                      unavailableAppIds?.includes(leader.app_id) ? (
                        <bdi>{text}</bdi>
                      ) : (
                        <Link
                          href={`/apps/${leader.app_id}`}
                          className="font-semibold underline"
                        >
                          {text}
                        </Link>
                      ),
                  })}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
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
  previousCharts,
  topApps,
  topGames,
  topEmulators,
  topGameStores,
  topGameUtilities,
  biggestGrowthByCategory,
  newcomersByCategory,
  unavailableAppIds,
  mostImprovedByCategory,
  popularAppsByCategory,
  geographicStats,
  hiddenGems,
  trendingCategories,
  platformStats,
  hasGeographicData = true,
}: YearInReviewProps) {
  const t = useTranslations()

  const seeds = useMemo(() => yearInReviewSpiral(newAppsCount), [newAppsCount])
  const arrivals = newcomersByCategory
    ?.filter(
      (app, index, all) =>
        all.findIndex((entry) => entry.app_id === app.app_id) === index,
    )
    .slice(0, 3)
  const getCategoryDisplayName = useCallback(
    (category: string): string => {
      const mainCategory = stringToCategory(category)
      return mainCategory ? categoryToName(mainCategory, t) : category
    },
    [t],
  )

  const filteredPlatformStats = useMemo(() => {
    if (!platformStats) {
      return undefined
    }
    return platformStats.filter((stat) => stat.percentage > 0.1)
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
    <div className="text-card-foreground [--paper:oklch(var(--card))] [--line:oklch(var(--border))] [--subtle:oklch(var(--muted-foreground))] dark:[--paper:color-mix(in_oklab,oklch(var(--card))_74%,oklch(var(--muted)))] dark:[--line:color-mix(in_oklab,var(--paper)_65%,oklch(var(--border)))] dark:[--subtle:color-mix(in_oklab,oklch(var(--muted-foreground))_70%,oklch(var(--card-foreground)))] dark:scheme-dark print:scheme-light print:[--paper:white] print:[--subtle:#444] print:[--line:#bbb] print:text-black [&_:is(a,button,select,summary):focus-visible]:outline-2 [&_:is(a,button,select,summary):focus-visible]:outline-ring [&_:is(a,button,select,summary):focus-visible]:-outline-offset-3">
      <div>
        <header className="rounded-t-[22px] border border-[#d9d7e7] bg-[linear-gradient(115deg,#d9eff4,#e3e2fa_58%,#f6deee)] p-[clamp(26px,4vw,60px)] text-[#28223e] dark:border-[#49445b] dark:bg-[linear-gradient(115deg,#173c48,#302f52_58%,#492d48)] dark:text-[#f2effa] print:bg-none print:text-black">
          <div className="min-w-0">
            <h1 className="text-balance text-[clamp(2rem,4vw,3.5rem)] leading-[1.12] font-[750]">
              {t("year-in-review.title", { year })}
            </h1>
            <div className="mt-[18px] max-w-[60ch] text-pretty text-base leading-[1.45]">
              {t("year-in-review.description")}
            </div>
          </div>
        </header>
        <section className="mb-10">
          <YearStatsGrid
            year={year}
            totalDownloads={totalDownloads}
            delta={totalDownloadsChange}
            change={totalDownloadsChangePercentage}
            hasPreviousYear={
              hasPreviousYear && totalDownloads - totalDownloadsChange > 0
            }
            totalApps={totalApps}
            updatesCount={updatesCount}
          />
        </section>

        {/* Popular Apps Section */}
        <section className="mb-24">
          <TopAppsSection
            year={year}
            previousCharts={previousCharts}
            topApps={topApps}
            topGames={topGames}
            topEmulators={topEmulators}
            topGameStores={topGameStores}
            topGameUtilities={topGameUtilities}
          />
        </section>

        <div className="grid gap-[clamp(24px,3vw,44px)]">
          <section className="grid grid-cols-[minmax(90px,145px)_minmax(0,1fr)] items-center gap-[clamp(16px,3vw,42px)] rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-[clamp(18px,3vw,40px)] py-5 max-md:grid-cols-[90px_minmax(0,1fr)] max-md:gap-4">
            <div className="min-w-0 only:col-span-full">
              <h2 className="text-start text-[clamp(18px,2vw,25px)] leading-tight font-semibold">
                {t("year-in-review.arrivals", { count: newAppsCount, year })}
              </h2>
              {newAppsCount > 0 && !!arrivals?.length && (
                <>
                  <p className="mt-2 text-sm text-[var(--subtle)]">
                    {t("year-in-review.meet-arrivals")}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    {arrivals.map((app) => {
                      const content = (
                        <span className="inline-flex items-center gap-2 py-1 font-semibold">
                          {app.icon && (
                            <LogoImage
                              iconUrl={app.icon}
                              appName={app.name}
                              size={24}
                            />
                          )}
                          <bdi className="wrap-anywhere">{app.name}</bdi>
                        </span>
                      )
                      return (
                        <li key={app.app_id}>
                          {unavailableAppIds?.includes(app.app_id) ? (
                            content
                          ) : (
                            <Link
                              href={`/apps/${app.app_id}`}
                              className="hover:underline"
                            >
                              {content}
                            </Link>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
            {newAppsCount > 0 && (
              <svg
                className="col-start-1 row-start-1 max-h-[255px] w-full max-sm:max-h-[172px]"
                aria-hidden="true"
                viewBox="-102 -99 204 207"
              >
                <defs>
                  <linearGradient
                    id={`review-spectrum-${year}`}
                    gradientUnits="userSpaceOnUse"
                    x1="-70"
                    y1="-70"
                    x2="70"
                    y2="70"
                  >
                    <stop className="[stop-color:#3176b6] dark:[stop-color:#78b4f1]" />
                    <stop
                      offset=".5"
                      className="[stop-color:#8151aa] dark:[stop-color:#c497ed]"
                    />
                    <stop
                      offset="1"
                      className="[stop-color:#b34279] dark:[stop-color:#f09ac5]"
                    />
                  </linearGradient>
                </defs>
                {seeds.map((seed, i) => (
                  <circle
                    key={i}
                    cx={seed.x}
                    cy={seed.y}
                    r={Math.min(9, 72 / Math.sqrt(newAppsCount))}
                    fill={`url(#review-spectrum-${year})`}
                  />
                ))}
              </svg>
            )}
          </section>
          {!!hiddenGems?.length && (
            <HiddenGemsSection hiddenGems={hiddenGems} />
          )}
          {!!categoriesData.length && (
            <CategoryHighlightsSection categoriesData={categoriesData} />
          )}
          {hasGeographicData && geographicStats && (
            <GeographicInsightsSection geographicStats={geographicStats} />
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,350px),1fr))] gap-[clamp(24px,5vw,76px)]">
            {!!trendingCategories?.length && (
              <TrendingCategoriesSection
                unavailableAppIds={unavailableAppIds}
                biggestGrowthByCategory={biggestGrowthByCategory}
                trendingCategories={trendingCategories}
                getCategoryDisplayName={getCategoryDisplayName}
                year={year}
              />
            )}
            <PlatformDiversitySection platformStats={filteredPlatformStats} />
          </div>
        </div>
      </div>
    </div>
  )
}
