import { NextSeo } from "next-seo"
import WorldMap, { CountryContext } from "react-svg-worldmap"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import styles from "./statistics.module.scss"
import {
  HiCloudArrowDown,
  HiCalendar,
  HiListBullet,
  HiCheckBadge,
} from "react-icons/hi2"

import ListBox from "../src/components/application/ListBox"
import { i18n, useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import { getIntlLocale } from "../src/localize"
import { tryParseCategory, tryParseSubCategory } from "src/types/Category"
import { useRouter } from "next/router"
import { useUserContext } from "src/context/user-info"
import { Permission, StatsResult } from "src/codegen/model"
import {
  getRuntimeListRuntimesGet,
  getStatsStatsGet,
  useGetQualityModerationStatsQualityModerationFailedByGuidelineGet,
} from "src/codegen"
import { format } from "date-fns"
import {
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  BarChart,
  Bar,
  Treemap,
} from "recharts"
import {
  primaryStroke,
  axisStroke,
  RotatedAxisTick,
  FlathubTooltip,
} from "src/chartComponents"
import { createRef, useState, type JSX } from "react"
import { ChartContainer, ChartConfig } from "@/components/ui/chart"
import ReactCountryFlag from "react-country-flag"
import clsx from "clsx"

const DownloadsPerCountry = ({ stats }: { stats: StatsResult }) => {
  const { t } = useTranslation()

  const regionName = new Intl.DisplayNames(i18n.language, { type: "region" })
  const regionNameFallback = new Intl.DisplayNames("en", { type: "region" })

  let country_data: {
    country: string;
    downloads: number;
    population: number
  }[] = []
  if (stats.countries) {
    for (const [key, value] of Object.entries(stats.countries)) {
      country_data.push({
        country: key,
        downloads_per_people: value.downloads / value.population,
      })
    }
  }

  const getLocalizedText = ({
    countryCode,
    countryValue,
    prefix,
    suffix,
  }: CountryContext) => {
    const regionName = new Intl.DisplayNames(i18n.language, { type: "region" })
    const regionNameFallback = new Intl.DisplayNames("en", { type: "region" })

    const translatedCountryValue = countryValue.toLocaleString(i18n.language)

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

  const refs = country_data.reduce((acc, value) => {
    acc[value.country] = createRef()
    return acc
  }, {})

  const handleClick = (id) =>
    refs[id].current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("downloads-per-country")}
      </h2>
      <div className="flex flex-col gap-5">
        <div className={`flex justify-center ${styles.map}`}>
          <WorldMap
            color="oklch(var(--color-primary))"
            backgroundColor="oklch(var(--bg-color-secondary))"
            borderColor="oklch(var(--text-primary))"
            size="responsive"
            data={country_data}
            tooltipTextFunction={getLocalizedText}
            rtl={i18n.dir() === "rtl"}
            onClickFunction={(context) => handleClick(context.countryCode)}
          />
        </div>
        <div
          className={clsx(
            "overflow-y-auto max-h-[500px]",
            "flex flex-col self-center",
            "rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic",
          )}
        >
          {country_data.toSorted(
              (a, b) => b.downloads_per_people - a.downloads_per_people
            ).map(({ country, downloads_per_people }, i) => {
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
                  <div>{downloads_per_people.toLocaleString(i18n.language)}</div>
                </div>
              )
            })}
        </div>
      </div>
    </>
  )
}

const DownloadsOverTime = ({ stats }: { stats: StatsResult }) => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()

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
              tickFormatter={(y) => y.toLocaleString(i18n.language)}
              stroke={axisStroke(resolvedTheme)}
              width={80}
            />
            <Tooltip
              content={<FlathubTooltip />}
              labelFormatter={(x) => format(x, "MMM yyyy")}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </>
  )
}

const FailedByGuideline = () => {
  const { t } = useTranslation()
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
                <Tooltip cursor={false} content={<FlathubTooltip />} />
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
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()

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
          <Treemap data={category_data} dataKey="value" nameKey={"name"}>
            <Tooltip cursor={false} content={<FlathubTooltip />} />
          </Treemap>
        </ChartContainer>
      </div>
    </>
  )
}

const RuntimeChart = ({ runtimes }: { runtimes: Record<string, number> }) => {
  const { t } = useTranslation()
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
            <Tooltip cursor={false} content={<FlathubTooltip />} />
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

const Statistics = ({
  stats,
  runtimes,
  locale,
}: {
  stats: StatsResult
  runtimes: { [key: string]: number }
  locale: string
}): JSX.Element => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo
        title={t("statistics")}
        description={t("flathub-statistics-description")}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/statistics`,
        }}
        noindex={locale === "en-GB"}
      />
      <div className="max-w-11/12 mx-auto mt-12 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="mb-8 text-4xl font-extrabold">{t("statistics")}</h1>
        <div className="flex flex-wrap gap-3 md:flex-nowrap">
          <ListBox
            items={[
              {
                icon: <HiCloudArrowDown />,
                header: t("count-downloads"),
                content: {
                  type: "text",
                  text: stats.totals.downloads?.toLocaleString(
                    getIntlLocale(i18n.language),
                  ),
                },
              },
            ]}
          />
          <ListBox
            items={[
              {
                icon: <HiListBullet />,
                header: t("count-desktop-apps"),
                content: {
                  type: "text",
                  text: stats.totals.number_of_apps?.toLocaleString(
                    getIntlLocale(i18n.language),
                  ),
                },
              },
            ]}
          />
          <ListBox
            items={[
              {
                icon: <HiCheckBadge />,
                header: t("count-verified-desktop-apps"),
                content: {
                  type: "text",
                  text: stats.totals.verified_apps?.toLocaleString(
                    getIntlLocale(i18n.language),
                  ),
                },
              },
            ]}
          />
          <ListBox
            items={[
              {
                icon: <HiCalendar />,
                header: t("since"),
                content: {
                  type: "text",
                  text: new Date(2018, 3, 29).toLocaleDateString(
                    getIntlLocale(i18n.language),
                  ),
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
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const stats = await getStatsStatsGet()

  const runtimes = await getRuntimeListRuntimesGet()

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      stats: stats.data,
      runtimes: runtimes.data,
      locale,
    },
    revalidate: 900,
  }
}

export default Statistics
