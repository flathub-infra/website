import { NextSeo } from "next-seo"
import WorldMap, { CountryContext } from "react-svg-worldmap"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { fetchRuntimes, fetchStats } from "../src/fetchers"
import { Stats as Statistics } from "../src/types/Stats"
import styles from "./statistics.module.scss"
import "chart.js/auto"
import { Bar, Line } from "react-chartjs-2"
import { chartOptions, chartStyle, barChartOptions } from "../src/chartHelper"
import "chartjs-adapter-date-fns"
import { HiCloudArrowDown, HiCalendar, HiListBullet } from "react-icons/hi2"

import ListBox from "../src/components/application/ListBox"
import { i18n, useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import { getIntlLocale, registerIsoCountriesLocales } from "../src/localize"
import { Category, categoryToName } from "src/types/Category"
import { useRouter } from "next/router"

const countries = registerIsoCountriesLocales()

const RuntimeChart = ({ runtimes, barOptions }) => {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <>
      <h2 className="mb-6 mt-12 text-2xl font-bold">
        {t("runtime-distribution")}
      </h2>
      <div className="h-[800px] rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
        <Bar
          data={{
            labels: Object.keys(runtimes),
            datasets: [
              {
                data: Object.values(runtimes),
                backgroundColor: ["rgb(74, 144, 217)"],
              },
            ],
          }}
          options={{
            ...barOptions,
            indexAxis: "y",
            onClick: (event: any) => {
              router.push(
                `/apps/search?runtime=${encodeURIComponent(
                  event.chart.tooltip.title[0],
                )}`,
              )
            },
          }}
        />
      </div>
    </>
  )
}

const Statistics = ({
  stats,
  runtimes,
}: {
  stats: Statistics
  runtimes: { [key: string]: number }
}): JSX.Element => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  let country_data: { country: string; value: number }[] = []
  if (stats.countries) {
    for (const [key, value] of Object.entries(stats.countries)) {
      country_data.push({ country: key, value: value })
    }
  }

  let category_data: { category: string; value: number }[] = []
  if (stats.category_totals) {
    for (const [key, value] of Object.entries(stats.category_totals)) {
      category_data.push({ category: key, value: value })
    }
  }

  let downloads_labels: string[] = []
  let downloads_data: number[] = []
  if (stats.downloads_per_day) {
    for (const [key, value] of Object.entries(stats.downloads_per_day)) {
      downloads_labels.push(key)
      downloads_data.push(value)
    }
  }

  // Remove current day
  downloads_labels.pop()
  downloads_data.pop()

  const data = chartStyle(
    downloads_labels,
    downloads_data,
    t("downloads"),
    resolvedTheme as "light" | "dark",
  )

  const options = chartOptions(i18n.language, resolvedTheme as "light" | "dark")
  const barOptions = barChartOptions(
    i18n.language,
    resolvedTheme as "light" | "dark",
  )

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
      <NextSeo
        title={t("statistics")}
        description={t("flathub-statistics-description")}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/statistics`,
        }}
      />
      <div className="max-w-11/12 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="my-8 text-4xl font-extrabold">{t("statistics")}</h1>
        <div className="flex flex-wrap gap-8 md:flex-nowrap">
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
        <h2 className="mb-6 mt-12 text-2xl font-bold">
          {t("downloads-per-country")}
        </h2>
        <div className={`flex justify-center ${styles.map}`}>
          <WorldMap
            color="rgb(var(--color-primary))"
            backgroundColor="rgb(var(--bg-color-secondary))"
            borderColor="rgb(var(--text-primary))"
            size="responsive"
            data={country_data}
            tooltipTextFunction={getLocalizedText}
            rtl={i18n.dir() === "rtl"}
          />
        </div>
        <h2 className="mb-6 mt-12 text-2xl font-bold">
          {t("downloads-over-time")}
        </h2>
        <div className="h-[500px] rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
          <Line data={data} options={options} />
        </div>
        <h2 className="mb-6 mt-12 text-2xl font-bold">
          {t("category-distribution")}
        </h2>
        <div className="h-[500px] rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic">
          <Bar
            data={{
              labels: category_data.map((x) =>
                categoryToName(x.category as Category, t),
              ),
              datasets: [
                {
                  data: category_data.map((x) => x.value),
                  backgroundColor: ["rgb(74, 144, 217)"],
                },
              ],
            }}
            options={barOptions}
          />
        </div>
        <RuntimeChart runtimes={runtimes} barOptions={barOptions} />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  console.log("Fetching data for stats")
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
