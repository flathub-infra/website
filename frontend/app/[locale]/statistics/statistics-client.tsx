"use client"

import WorldMap, { CountryContext } from "react-svg-worldmap"

import styles from "./statistics.module.scss"
import {
  CloudArrowDownIcon,
  CalendarIcon,
  ListBulletIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/solid"
import ListBox from "../../../src/components/application/ListBox"
import { useTheme } from "next-themes"
import { getIntlLocale } from "../../../src/localize"
import { tryParseCategory } from "../../../src/types/Category"
import { useUserContext } from "../../../src/context/user-info"
import { Permission, StatsResult } from "../../../src/codegen/model"
import { useGetQualityModerationStatsQualityModerationFailedByGuidelineGet } from "../../../src/codegen"
import { format } from "date-fns"
import { LineChart, XAxis, YAxis, Line, BarChart, Treemap, Bar } from "recharts"
import {
  primaryStroke,
  axisStroke,
  RotatedAxisTick,
  FlathubTooltip,
} from "../../../src/chartComponents"
import { createRef, useState, type JSX } from "react"
import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import ReactCountryFlag from "react-country-flag"
import clsx from "clsx"
import { useLocale, useTranslations } from "next-intl"
import { getLangDir } from "rtl-detect"
import { useRouter } from "src/i18n/navigation"

interface StatisticsClientProps {
  stats: StatsResult
  runtimes: { [key: string]: number }
  locale: string
}

export const FlathubWorldMap = ({
  country_data,
  refs,
}: {
  country_data: { country: string; value: number }[]
  refs?: { [key: string]: React.RefObject<HTMLDivElement> }
}) => {
  const t = useTranslations()
  const locale = useLocale()

  const getLocalizedText = ({
    countryCode,
    countryValue,
    prefix,
    suffix,
  }: CountryContext) => {
    const regionName = new Intl.DisplayNames(locale, { type: "region" })
    const regionNameFallback = new Intl.DisplayNames("en", { type: "region" })

    const translatedCountryValue = countryValue.toLocaleString(locale)

    const downloadTranslation = t("x-downloads", {
      x: translatedCountryValue,
      count: countryValue,
    })

    const translation = `${
      regionName.of(countryCode) ??
      regionNameFallback.of(countryCode) ??
      t("unknown")
    }: ${downloadTranslation}`

    return translation
  }

  const handleClick = (id) =>
    refs?.[id]?.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })

  return (
    <div className={`flex justify-center ${styles.map}`}>
      <WorldMap
        color="oklch(var(--color-primary))"
        backgroundColor="oklch(var(--bg-color-secondary))"
        borderColor="oklch(var(--text-primary))"
        size="responsive"
        data={country_data}
        tooltipTextFunction={getLocalizedText}
        rtl={getLangDir(locale) === "rtl"}
        onClickFunction={(context) => handleClick(context.countryCode)}
      />
    </div>
  )
}

const DownloadsPerCountry = ({ stats }: { stats: StatsResult }) => {
  const t = useTranslations()
  const locale = useLocale()
  const i18n = getIntlLocale(locale)

  const regionName = new Intl.DisplayNames(i18n.language, { type: "region" })
  const regionNameFallback = new Intl.DisplayNames("en", { type: "region" })

  let country_data: { country: string; value: number }[] = []
  if (stats.countries) {
    for (const [key, value] of Object.entries(stats.countries)) {
      country_data.push({ country: key, value: value })
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
            "flex flex-col self-center",
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
                    <div>
                      {regionName.of(country) ??
                        regionNameFallback.of(country) ??
                        t("unknown")}
                    </div>
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
  const { resolvedTheme } = useTheme()
  const locale = useLocale()

  const data = []
  if (stats.downloads_per_day) {
    for (const [key, value] of Object.entries(stats.downloads_per_day)) {
      data.push({ date: key, downloads: value })
    }
  }

  // Remove current day
  data.pop()

  const chartConfig = {
    downloads: {
      color: primaryStroke(resolvedTheme),
    },
  } satisfies ChartConfig

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("downloads-over-time")}
      </h2>
      <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <ChartContainer config={chartConfig} className="min-h-[500px] w-full">
          <LineChart accessibilityLayer data={data}>
            <Line
              dataKey="downloads"
              name={t("downloads")}
              dot={false}
              strokeWidth={3}
            />
            <XAxis
              dataKey="date"
              name={t("date")}
              tickFormatter={(date) => {
                return format(date, "MMM yyyy")
              }}
              stroke={axisStroke(resolvedTheme)}
              tick={<RotatedAxisTick />}
              height={80}
            />
            <YAxis
              tickFormatter={(y) => y.toLocaleString(locale)}
              stroke={axisStroke(resolvedTheme)}
              width={80}
            />
            <ChartTooltip
              content={<FlathubTooltip hideIndicator />}
              labelFormatter={(x) => format(x, "MMM yyyy")}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </>
  )
}

const FailedByGuideline = () => {
  const t = useTranslations()
  const { resolvedTheme } = useTheme()
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

  const chartConfig = {
    downloads: {
      color: "oklch(var(--flathub-celestial-blue))",
    },
  } satisfies ChartConfig

  return (
    <>
      {query.data?.data && (
        <>
          <h2 className="mb-6 mt-12 text-2xl font-bold">Failed by guideline</h2>
          <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
            <ChartContainer
              config={chartConfig}
              className="min-h-[500px] w-full"
            >
              <BarChart
                accessibilityLayer
                layout="vertical"
                data={query.data.data.map((x) => ({
                  ...x,
                  guideline_id: t(`quality-guideline.${x.guideline_id}`),
                }))}
              >
                <XAxis stroke={axisStroke(resolvedTheme)} type="number" />
                <YAxis
                  stroke={axisStroke(resolvedTheme)}
                  dataKey="guideline_id"
                  tickFormatter={(x) => x}
                  type="category"
                  width={180}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideIndicator />}
                />
                <Bar
                  dataKey="not_passed"
                  name={t("quality-guideline.not-passed")}
                  fill="var(--color-downloads)"
                />
              </BarChart>
            </ChartContainer>
          </div>
        </>
      )}
    </>
  )
}

const CategoryDistribution = ({ stats }: { stats: StatsResult }) => {
  const t = useTranslations()

  const chartConfig = {
    category: {
      color: "oklch(var(--flathub-celestial-blue))",
    },
  } satisfies ChartConfig

  let category_data = stats.category_totals.map((category) => ({
    name:
      tryParseCategory(category.category, t) ??
      tryParseCategory(category.category, t),
    value: category.count,
  }))

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("category-distribution")}
      </h2>
      <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <ChartContainer config={chartConfig} className="min-h-[500px] w-full">
          <Treemap data={category_data} dataKey="value" nameKey="name">
            <ChartTooltip
              cursor={false}
              content={<FlathubTooltip hideIndicator />}
            />
          </Treemap>
        </ChartContainer>
      </div>
    </>
  )
}

const RuntimeChart = ({ runtimes }: { runtimes: Record<string, number> }) => {
  const t = useTranslations()
  const router = useRouter()
  const { resolvedTheme } = useTheme()

  const data = []
  for (const [key, value] of Object.entries(runtimes)) {
    data.push({ name: key, value })
  }

  const [hover, setHover] = useState()

  const chartConfig = {} satisfies ChartConfig

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("runtime-distribution")}
      </h2>
      <div className=" rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <ChartContainer config={chartConfig} className="min-h-[800px] w-full">
          <BarChart accessibilityLayer layout="vertical" data={data}>
            <XAxis stroke={axisStroke(resolvedTheme)} type="number" />
            <YAxis
              type="category"
              dataKey="name"
              width={230}
              tick={{ fontSize: 12 }}
              tickLine={false}
              stroke={axisStroke(resolvedTheme)}
            />
            <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
            <Bar
              onClick={(event: any) =>
                router.push(
                  `/apps/search?runtime=${encodeURIComponent(event.name)}`,
                )
              }
              onMouseEnter={(event: any) => {
                setHover(event.index)
              }}
              onMouseLeave={(event: any) => {
                setHover(null)
              }}
              dataKey="value"
              name={t("count")}
              shape={(props: any) => (
                <rect
                  {...props}
                  onMouseEnter={() => setHover(props.index)}
                  onMouseLeave={() => setHover(null)}
                  fill={
                    hover === props.index
                      ? "oklch(55.86% 0.1446 253.19)"
                      : "oklch(63.85% 0.1314 251.94)"
                  }
                />
              )}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </>
  )
}

const StatisticsClient = ({
  stats,
  runtimes,
  locale,
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

      <DownloadsPerCountry stats={stats} />
      <DownloadsOverTime stats={stats} />
      <CategoryDistribution stats={stats} />
      <RuntimeChart runtimes={runtimes} />
      <FailedByGuideline />
    </div>
  )
}

export default StatisticsClient
