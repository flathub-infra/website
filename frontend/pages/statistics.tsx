import { NextSeo } from "next-seo"
import WorldMap, { CountryContext } from "react-svg-worldmap"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import styles from "./statistics.module.scss"
import { HiCloudArrowDown, HiCalendar, HiListBullet } from "react-icons/hi2"

import ListBox from "../src/components/application/ListBox"
import { i18n, useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import { getIntlLocale, registerIsoCountriesLocales } from "../src/localize"
import { Category, categoryToName } from "src/types/Category"
import { useRouter } from "next/router"
import { useQuery } from "@tanstack/react-query"
import { useUserContext } from "src/context/user-info"
import { Permission, StatsResult } from "src/codegen/model"
import { getQualityModerationStatsQualityModerationFailedByGuidelineGet } from "src/codegen"
import { fetchRuntimes, fetchStats } from "src/fetchers"
import { format } from "date-fns"
import { LineChart, XAxis, YAxis, Tooltip, Line, BarChart, Bar } from "recharts"
import {
  primaryStroke,
  axisStroke,
  RotatedAxisTick,
  FlathubTooltip,
} from "src/chartComponents"
import { useState, type JSX } from "react"
import { ChartContainer, ChartConfig } from "@/components/ui/chart"

const countries = registerIsoCountriesLocales()

const DownloadsPerCountry = ({ stats }: { stats: StatsResult }) => {
  const { t } = useTranslation()

  let country_data: { country: string; value: number }[] = []
  if (stats.countries) {
    for (const [key, value] of Object.entries(stats.countries)) {
      country_data.push({ country: key, value: value })
    }
  }

  const getLocalizedText = ({
    countryCode,
    countryValue,
    prefix,
    suffix,
  }: CountryContext) => {
    const translatedCountryName = countries.getName(countryCode, i18n.language)
    const translatedCountryValue = countryValue.toLocaleString(i18n.language)

    const downloadTranslation = t("x-downloads", {
      x: translatedCountryValue,
      count: countryValue,
    })

    const translation = `${
      translatedCountryName ??
      countries.getName(countryCode, "en") ??
      t("unknown")
    }: ${downloadTranslation}`

    return translation
  }

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("downloads-per-country")}
      </h2>
      <div className={`flex justify-center ${styles.map}`}>
        <WorldMap
          color="hsl(var(--color-primary))"
          backgroundColor="hsl(var(--bg-color-secondary))"
          borderColor="hsl(var(--text-primary))"
          size="responsive"
          data={country_data}
          tooltipTextFunction={getLocalizedText}
          rtl={i18n.dir() === "rtl"}
        />
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

  const query = useQuery({
    queryKey: ["failed-by-guideline"],
    queryFn: () =>
      getQualityModerationStatsQualityModerationFailedByGuidelineGet({
        withCredentials: true,
      }),
    enabled: !!user.info?.permissions.some(
      (a) => a === Permission["quality-moderation"],
    ),
  })

  const chartConfig = {
    downloads: {
      color: "hsl(var(--flathub-celestial-blue))",
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

  let category_data: { category: string; value: number }[] = []
  if (stats.category_totals) {
    for (const [key, value] of Object.entries(stats.category_totals)) {
      category_data.push({ category: key, value: value })
    }
  }

  const chartConfig = {
    category: {
      color: "hsl(var(--flathub-celestial-blue))",
    },
  } satisfies ChartConfig

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("category-distribution")}
      </h2>
      <div className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <ChartContainer config={chartConfig} className="min-h-[500px] w-full">
          <BarChart
            accessibilityLayer
            layout="vertical"
            data={category_data.map((x) => ({ ...x, name: x.category }))}
          >
            <XAxis stroke={axisStroke(resolvedTheme)} type="number" />
            <YAxis
              stroke={axisStroke(resolvedTheme)}
              dataKey="category"
              tickFormatter={(x) => categoryToName(x as Category, t)}
              type="category"
              width={180}
              tickLine={false}
            />
            <Tooltip
              labelFormatter={(x) => categoryToName(x as Category, t)}
              cursor={false}
              content={<FlathubTooltip />}
            />
            <Bar dataKey="value" fill="var(--color-category)" />
          </BarChart>
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
                      ? "hsl(211, 65%, 47%)"
                      : "hsl(211, 65%, 57%"
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
}: {
  stats: StatsResult
  runtimes: { [key: string]: number }
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
                  text: stats.downloads?.toLocaleString(
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
                  text: stats.number_of_apps?.toLocaleString(
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
  const stats = await fetchStats()

  const runtimes = await fetchRuntimes()

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      stats,
      runtimes,
    },
    revalidate: 900,
  }
}

export default Statistics
