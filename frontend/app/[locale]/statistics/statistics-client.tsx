"use client"

import {
  CloudArrowDownIcon,
  CalendarIcon,
  ListBulletIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/solid"
import ListBox from "../../../src/components/application/ListBox"
import { tryParseCategory } from "../../../src/types/Category"
import { useUserContext } from "../../../src/context/user-info"
import { Permission, StatsResult } from "../../../src/codegen/model"
import {
  useGetQualityModerationStatsByCategoryQualityModerationStatsByCategoryGet,
  useGetQualityModerationStatsQualityModerationFailedByGuidelineGet,
} from "../../../src/codegen"
import { format } from "date-fns"
import { barX, defineChart, lineY, stack } from "@tanstack/charts"
import { createCategoryDistributionChart } from "src/components/charts/category-distribution"
import { rectangleFocusStates } from "src/components/charts/rectangle-focus"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { primaryStroke } from "../../../src/chartComponents"
import { createRef, useMemo, type JSX } from "react"
import { ChartLegendItems, TanstackChart } from "src/components/charts/chart"
import ReactCountryFlag from "react-country-flag"
import clsx from "clsx"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "src/i18n/navigation"
import CountryMap, { type CountryMapValue } from "@/components/ui/country-map"

interface StatisticsClientProps {
  stats: StatsResult
  runtimes: { [key: string]: number }
  locale: string
  countryNames: Record<string, string>
}

export const FlathubWorldMap = ({
  country_data,
  refs,
}: {
  country_data: CountryMapValue[]
  refs?: { [key: string]: React.RefObject<HTMLDivElement> }
}) => {
  const handleClick = (countryCode: string) =>
    refs?.[countryCode]?.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })

  return <CountryMap data={country_data} onCountrySelect={handleClick} />
}

const DownloadsPerCountry = ({
  stats,
  countryNames,
}: {
  stats: StatsResult
  countryNames: Record<string, string>
}) => {
  const t = useTranslations()
  const locale = useLocale()

  let country_data: CountryMapValue[] = []
  if (stats.countries) {
    for (const [key, value] of Object.entries(stats.countries)) {
      country_data.push({
        country: key,
        value: value,
      })
    }
  }

  const refs = country_data.reduce((acc, value) => {
    acc[value.country] = createRef()
    return acc
  }, {})

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("downloads-per-country")}
      </h2>
      <div className="flex flex-col gap-5">
        <div
          className={clsx(
            "flex w-full max-w-[600px] flex-col self-center",
            "rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic",
          )}
        >
          <FlathubWorldMap country_data={country_data} refs={refs} />
        </div>
        <div
          className={clsx(
            "overflow-y-auto max-h-[500px]",
            "flex flex-col self-center",
            "rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic",
          )}
        >
          {country_data
            .toSorted((a, b) => b.value - a.value)
            .map(({ country, value }, i) => {
              return (
                <div
                  key={country}
                  ref={refs[country]}
                  className="flex gap-4 items-center justify-between px-4 py-2"
                >
                  <div className="text-lg font-semibold">{i + 1}.</div>
                  <div className="flex gap-2 items-center">
                    <ReactCountryFlag countryCode={country} />
                    <div>{countryNames[country] ?? t("unknown")}</div>
                  </div>
                  <div>{value.toLocaleString(locale)}</div>
                </div>
              )
            })}
        </div>
      </div>
    </>
  )
}

const DownloadsOverTime = ({ stats }: { stats: StatsResult }) => {
  const t = useTranslations()
  const locale = useLocale()

  const data = []
  if (stats.downloads_per_day) {
    for (const [key, value] of Object.entries(stats.downloads_per_day)) {
      data.push({ date: key, downloads: value })
    }
  }

  // Remove current day
  data.pop()

  const stroke = primaryStroke
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(data, {
            x: "date",
            y: "downloads",
            stroke,
            strokeWidth: 3,
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand<string>().padding(0.2),
            axis: {
              ticks: { size: 0, format: (date) => format(date, "MMM yyyy") },
              tickLabels: { rotate: -35, anchor: "end" },
            },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              ticks: {
                format: (value) => value.toLocaleString(locale),
              },
            },
          },
        },
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${format(point.datum.date, "MMM yyyy")}: ${Number(point.yValue).toLocaleString(locale)}`,
        },
      }),
    [data, locale, stroke],
  )

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("downloads-over-time")}
      </h2>
      <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <TanstackChart
          definition={definition}
          ariaLabel={t("downloads-over-time")}
          height={500}
          className="min-h-[500px] w-full"
        />
      </div>
    </>
  )
}

const FailedByGuideline = () => {
  const t = useTranslations()
  const locale = useLocale()
  const user = useUserContext()

  const query =
    useGetQualityModerationStatsQualityModerationFailedByGuidelineGet({
      axios: { withCredentials: true },
      query: {
        enabled: !!user.info?.permissions.some(
          (a) => a === Permission["quality-moderation"],
        ),
      },
    })

  const data = useMemo(
    () =>
      (query.data?.data ?? []).map((row) => ({
        ...row,
        guideline_id: t(`quality-guideline.${row.guideline_id}`),
      })),
    [query.data?.data, t],
  )
  const definition = useMemo(
    () =>
      defineChart({
        focusRing: false,
        marks: [
          barX(data, {
            x: "not_passed",
            states: rectangleFocusStates,
            y: "guideline_id",
            fill: "oklch(var(--flathub-celestial-blue))",
          }),
        ],
        scales: {
          x: { scale: scaleLinear, nice: true, grid: true },
          y: { scale: () => scaleBand<string>().padding(0.15) },
        },
        tooltip: {
          use: tooltip,
          anchor: "pointer",
          offset: 12,
          format: (point) => Number(point.xValue).toLocaleString(locale),
        },
      }),
    [data, locale],
  )

  return (
    <>
      {query.data?.data && (
        <>
          <h2 className="mb-6 mt-12 text-2xl font-bold">Failed by guideline</h2>
          <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
            <TanstackChart
              definition={definition}
              ariaLabel="Failed by guideline"
              height={500}
              className="min-h-[500px] w-full"
            />
          </div>
        </>
      )}
    </>
  )
}

const GuidelineStatsByCategory = () => {
  const t = useTranslations()
  const locale = useLocale()
  const user = useUserContext()

  const query =
    useGetQualityModerationStatsByCategoryQualityModerationStatsByCategoryGet({
      axios: { withCredentials: true },
      query: {
        enabled: !!user.info?.permissions.some(
          (a) => a === Permission["quality-moderation"],
        ),
      },
    })

  const colors = {
    passed: "oklch(var(--flathub-status-green))",
    not_passed: "oklch(var(--flathub-status-red))",
    unrated: "oklch(var(--flathub-sonic-silver))",
  }
  const data = useMemo(
    () =>
      (query.data?.data ?? []).flatMap((row) => {
        const category = t(`quality-guideline.${row.category}`)
        return (["passed", "not_passed", "unrated"] as const).map((series) => ({
          category,
          series: t(
            `quality-guideline.${series === "unrated" ? "pending" : series === "not_passed" ? "not-passed" : "passed"}`,
          ),
          value: row[series],
          color: colors[series],
        }))
      }),
    [query.data?.data, t],
  )
  const definition = useMemo(
    () =>
      defineChart({
        focusRing: false,
        marks: [
          barX(data, {
            x: "value",
            y: "category",
            states: rectangleFocusStates,
            z: "series",
            fill: (row) => row.color,
            layout: stack(),
          }),
        ],
        scales: {
          x: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              ticks: { format: (value) => value.toLocaleString(locale) },
            },
          },
          y: { scale: () => scaleBand<string>().padding(0.2) },
        },
        tooltip: {
          use: tooltip,
          anchor: "pointer",
          offset: 12,
          content: (points) => ({
            title: points[0]?.datum.category,
            rows: points.map((point) => ({
              label: point.groupLabel,
              value: Number(point.datum.value).toLocaleString(locale),
              color: point.color,
            })),
          }),
        },
      }),
    [data, locale],
  )

  return (
    <>
      {query.data?.data && (
        <>
          <h2 className="mb-6 mt-12 text-2xl font-bold">
            {t("quality-guideline.stats-by-category")}
          </h2>
          <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
            <div className="min-h-[360px] w-full">
              <TanstackChart
                definition={definition}
                ariaLabel={t("quality-guideline.stats-by-category")}
                height={360}
              />
              <ChartLegendItems
                items={[
                  {
                    label: t("quality-guideline.passed"),
                    color: colors.passed,
                  },
                  {
                    label: t("quality-guideline.not-passed"),
                    color: colors.not_passed,
                  },
                  {
                    label: t("quality-guideline.pending"),
                    color: colors.unrated,
                  },
                ]}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

const CategoryDistribution = ({ stats }: { stats: StatsResult }) => {
  const t = useTranslations()
  const locale = useLocale()

  const category_data = useMemo(
    () =>
      stats.category_totals.map((category) => ({
        name:
          tryParseCategory(category.category, t) ??
          tryParseCategory(category.category, t),
        value: category.count,
      })),
    [stats.category_totals, t],
  )
  const definition = useMemo(
    () => createCategoryDistributionChart(category_data, locale, CHART_COLORS),
    [category_data, locale],
  )

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("category-distribution")}
      </h2>
      <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <TanstackChart
          definition={definition}
          ariaLabel={t("category-distribution")}
          height={500}
          className="min-h-[500px] w-full"
        />
      </div>
    </>
  )
}

const RuntimeChart = ({ runtimes }: { runtimes: Record<string, number> }) => {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()

  const data = useMemo(
    () => Object.entries(runtimes).map(([name, value]) => ({ name, value })),
    [runtimes],
  )
  const definition = useMemo(
    () =>
      defineChart({
        focusRing: false,
        marks: [
          barX(data, {
            x: "value",
            y: "name",
            states: rectangleFocusStates,
            fill: "oklch(63.85% 0.1314 251.94)",
          }),
        ],
        scales: {
          x: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              ticks: { format: (value) => value.toLocaleString(locale) },
            },
          },
          y: { scale: () => scaleBand<string>().padding(0.15) },
        },
        tooltip: {
          use: tooltip,
          anchor: "pointer",
          offset: 12,
          content: (points) => ({
            title: points[0]?.datum.name,
            rows: points.map((point) => ({
              label: t("count"),
              value: Number(point.xValue).toLocaleString(locale),
              color: point.color,
            })),
          }),
        },
      }),
    [data, locale, t],
  )

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("runtime-distribution")}
      </h2>
      <div className=" rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <TanstackChart
          definition={definition}
          ariaLabel={t("runtime-distribution")}
          height={800}
          className="min-h-[800px] w-full"
          onSelect={(point) => {
            const runtime = (point?.datum as (typeof data)[number] | undefined)
              ?.name
            if (runtime) {
              router.push(`/apps/search?runtime=${encodeURIComponent(runtime)}`)
            }
          }}
        />
      </div>
    </>
  )
}

const CHART_COLORS = [
  "oklch(63.85% 0.1314 251.94)",
  "oklch(55.86% 0.1446 253.19)",
  "oklch(72% 0.12 200)",
  "oklch(65% 0.15 170)",
  "oklch(60% 0.13 300)",
  "oklch(70% 0.14 30)",
  "oklch(65% 0.12 100)",
  "oklch(58% 0.16 340)",
]

const HIDDEN_OS = new Set([
  "org.gnome.Platform",
  "org.gnome.Sdk",
  "org.freedesktop.Platform",
  "org.freedesktop.Sdk",
  "org.kde.Platform",
  "org.kde.Sdk",
])

function formatOsLabel(raw: string): string {
  // raw format is "name;version" e.g. "fedora;44", "bazzite;44", "arch;unknown"
  const [name, version] = raw.split(";")
  const display = name.charAt(0).toUpperCase() + name.slice(1)
  if (!version || version === "unknown") {
    return display
  }
  return `${display} ${version}`
}

function toPercentageData(
  raw: { [key: string]: number },
  topN = 15,
  labelFn: (k: string) => string = (k) => k,
) {
  const total = Object.values(raw).reduce((s, v) => s + v, 0)
  if (total === 0) {
    return []
  }
  const sorted = Object.entries(raw)
    .map(([name, value]) => ({
      name: labelFn(name),
      value: Math.round((value / total) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value)

  if (sorted.length <= topN) {
    return sorted
  }

  const top = sorted.slice(0, topN)
  const otherValue = sorted.slice(topN).reduce((s, e) => s + e.value, 0)
  top.push({ name: "Other", value: Math.round(otherValue * 10) / 10 })
  return top
}

function PercentageDistributionChart({
  data,
  title,
  shareLabel,
}: {
  data: { name: string; value: number }[]
  title: string
  shareLabel: string
}) {
  const definition = useMemo(
    () =>
      defineChart({
        focusRing: false,
        marks: [
          barX(data, {
            x: "value",
            y: "name",
            states: rectangleFocusStates,
            fill: (row) => {
              const index = data.indexOf(row)
              return CHART_COLORS[index % CHART_COLORS.length]
            },
            radius: 2,
          }),
        ],
        scales: {
          x: {
            scale: () => scaleLinear().domain([0, 100]),
            grid: true,
            axis: { ticks: { format: (value) => `${value}%` } },
          },
          y: {
            scale: () => scaleBand<string>().padding(0.2),
            axis: { tickLabels: { fontSize: 12 } },
          },
        },
        tooltip: {
          use: tooltip,
          anchor: "pointer",
          offset: 12,
          content: (points) => ({
            title: points[0]?.datum.name,
            rows: points.map((point) => ({
              label: shareLabel,
              value: `${point.datum.value}%`,
              color: point.color,
            })),
          }),
        },
      }),
    [data, shareLabel],
  )

  return (
    <TanstackChart
      definition={definition}
      ariaLabel={title}
      height={Math.max(300, data.length * 40)}
      style={{ height: Math.max(300, data.length * 40) }}
      className="w-full"
    />
  )
}

const OsVersionsChart = ({ stats }: { stats: StatsResult }) => {
  const t = useTranslations()

  const osVersions = { ...(stats.os_versions ?? {}) }
  let hiddenCount = 0

  for (const [name, count] of Object.entries(osVersions)) {
    const [os] = name.split(";", 1)

    if (HIDDEN_OS.has(os)) {
      hiddenCount += count
      delete osVersions[name]
    }
  }

  const data = toPercentageData(osVersions, 10, formatOsLabel)

  if (hiddenCount > 0) {
    const grandTotal = Object.values(stats.os_versions ?? {}).reduce(
      (sum, v) => sum + v,
      0,
    )
    const hiddenPct = Math.round((hiddenCount / grandTotal) * 1000) / 10

    const otherEntry = data.find((d) => d.name === "Other")
    if (otherEntry) {
      otherEntry.value = Math.round((otherEntry.value + hiddenPct) * 10) / 10
    } else {
      data.push({ name: "Other", value: hiddenPct })
    }
  }

  if (data.length === 0) {
    return null
  }

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("os-version-distribution")}
      </h2>
      <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <PercentageDistributionChart
          data={data}
          title={t("os-version-distribution")}
          shareLabel={t("share")}
        />
      </div>
    </>
  )
}

const FlatpakVersionsChart = ({ stats }: { stats: StatsResult }) => {
  const t = useTranslations()

  const data = toPercentageData(stats.flatpak_versions ?? {}, 10)
  if (data.length === 0) {
    return null
  }

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("flatpak-version-distribution")}
      </h2>
      <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <PercentageDistributionChart
          data={data}
          title={t("flatpak-version-distribution")}
          shareLabel={t("share")}
        />
      </div>
    </>
  )
}

const OsFlatpakVersionsChart = ({ stats }: { stats: StatsResult }) => {
  const t = useTranslations()

  const raw = stats.os_flatpak_versions ?? {}

  // Keep only top 10 OS versions by total count, collapse the rest into "Other"
  const TOP_OS = 10
  const allEntries = Object.entries(raw).map(([osVer, fp]) => ({
    osVer,
    total: Object.values(fp).reduce((s, v) => s + v, 0),
    fp,
  }))

  const hiddenEntries = allEntries.filter(({ osVer }) =>
    HIDDEN_OS.has(osVer.split(";", 1)[0]),
  )
  const visibleEntries = allEntries
    .filter(({ osVer }) => !HIDDEN_OS.has(osVer.split(";", 1)[0]))
    .sort((a, b) => b.total - a.total)

  const topEntries = visibleEntries.slice(0, TOP_OS)
  const otherEntries = [...visibleEntries.slice(TOP_OS), ...hiddenEntries]

  if (otherEntries.length > 0) {
    const otherFp: Record<string, number> = {}
    for (const { fp } of otherEntries) {
      for (const [ver, count] of Object.entries(fp)) {
        otherFp[ver] = (otherFp[ver] ?? 0) + count
      }
    }
    const otherTotal = otherEntries.reduce((s, e) => s + e.total, 0)
    topEntries.push({ osVer: "Other", total: otherTotal, fp: otherFp })
  }

  // All flatpak versions across kept rows
  const fpVersions = Array.from(
    new Set(topEntries.flatMap(({ fp }) => Object.keys(fp))),
  ).sort()

  // Grand total for computing each OS row's share of overall installs
  const grandTotal = allEntries.reduce((s, e) => s + e.total, 0)

  // Normalize each row to 100% of its own OS installs so bars show
  // Flatpak version distribution *within* each OS
  const data = topEntries.map(({ osVer, total, fp }) => {
    const rowTotal = total
    const row: Record<string, string | number> = {
      name: osVer === "Other" ? "Other" : formatOsLabel(osVer),
      _share:
        grandTotal > 0 ? Math.round((rowTotal / grandTotal) * 1000) / 10 : 0,
    }
    const shares = fpVersions.map((fpVer) =>
      rowTotal > 0 ? Math.round(((fp[fpVer] ?? 0) / rowTotal) * 1000) / 10 : 0,
    )
    if (rowTotal > 0 && shares.length > 0) {
      // Independent one-decimal rounding can make a stack slightly over or under 100%.
      const largestShareIndex = shares.reduce(
        (largestIndex, share, index) =>
          share > shares[largestIndex] ? index : largestIndex,
        0,
      )
      const roundingError =
        Math.round((100 - shares.reduce((sum, share) => sum + share, 0)) * 10) /
        10
      shares[largestShareIndex] += roundingError
    }
    fpVersions.forEach((fpVer, index) => {
      row[fpVer] = shares[index]
    })
    return row
  })

  const seriesData = data.flatMap((row) =>
    fpVersions.map((version) => ({
      name: String(row.name),
      shareOfInstalls: Number(row._share),
      version,
      value: Number(row[version]),
    })),
  )
  const definition = useMemo(
    () =>
      defineChart({
        focusRing: false,
        marks: [
          barX(seriesData, {
            x: "value",
            y: "name",
            states: rectangleFocusStates,
            z: "version",
            fill: (row) =>
              CHART_COLORS[
                fpVersions.indexOf(row.version) % CHART_COLORS.length
              ],
            layout: stack(),
          }),
        ],
        scales: {
          x: {
            scale: () => scaleLinear().domain([0, 100]),
            grid: true,
            axis: { ticks: { format: (value) => `${value}%` } },
          },
          y: { scale: () => scaleBand<string>().padding(0.2) },
        },
        tooltip: {
          use: tooltip,
          anchor: "pointer",
          offset: 12,
          content: (points) => {
            const rowName = points[0]?.datum.name ?? ""
            const share = points[0]?.datum.shareOfInstalls
            return {
              title: `${rowName}${share == null ? "" : ` (${share}% of installs)`}`,
              rows: points.map((point) => ({
                label: point.datum.version,
                value: `${point.datum.value}%`,
                color: point.color,
              })),
            }
          },
        },
      }),
    [seriesData, fpVersions],
  )

  if (data.length === 0) {
    return null
  }

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("os-flatpak-version-distribution")}
      </h2>
      <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <TanstackChart
          definition={definition}
          ariaLabel={t("os-flatpak-version-distribution")}
          height={Math.max(300, data.length * 40) + 60}
          className="w-full"
        />
        <ChartLegendItems
          items={fpVersions.map((version, index) => ({
            label: version,
            color: CHART_COLORS[index % CHART_COLORS.length],
          }))}
        />
      </div>
    </>
  )
}

const StatisticsClient = ({
  stats,
  runtimes,
  locale,
  countryNames,
}: StatisticsClientProps): JSX.Element => {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 mx-auto mt-12 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h1 className="mb-8 text-4xl font-extrabold">{t("statistics")}</h1>
      <div className="flex flex-wrap gap-3 md:flex-nowrap">
        <ListBox
          items={[
            {
              icon: <CloudArrowDownIcon className="size-6" />,
              header: t("count-downloads"),
              content: {
                type: "text",
                text: stats.totals.downloads?.toLocaleString(locale),
              },
            },
          ]}
        />
        <ListBox
          items={[
            {
              icon: <ListBulletIcon className="size-6" />,
              header: t("count-desktop-apps"),
              content: {
                type: "text",
                text: stats.totals.number_of_apps?.toLocaleString(locale),
              },
            },
          ]}
        />
        <ListBox
          items={[
            {
              icon: <CheckBadgeIcon className="size-6" />,
              header: t("count-verified-desktop-apps"),
              content: {
                type: "text",
                text: stats.totals.verified_apps?.toLocaleString(locale),
              },
            },
          ]}
        />
        <ListBox
          items={[
            {
              icon: <CalendarIcon className="size-6" />,
              header: t("since"),
              content: {
                type: "text",
                text: new Date(2018, 3, 29).toLocaleDateString(locale),
              },
            },
          ]}
        />
      </div>

      <DownloadsPerCountry stats={stats} countryNames={countryNames} />
      <DownloadsOverTime stats={stats} />
      <CategoryDistribution stats={stats} />
      <OsVersionsChart stats={stats} />
      <FlatpakVersionsChart stats={stats} />
      <OsFlatpakVersionsChart stats={stats} />
      <RuntimeChart runtimes={runtimes} />
      <GuidelineStatsByCategory />
      <FailedByGuideline />
    </div>
  )
}

export default StatisticsClient
