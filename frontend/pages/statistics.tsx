import { NextSeo } from "next-seo"
import WorldMap, { CountryContext } from "react-svg-worldmap"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { fetchStats } from "../src/fetchers"
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
import { getIntlLocale } from "../src/localize"
import { Category, categoryToName } from "src/types/Category"
const countries = require("i18n-iso-countries")
countries.registerLocale(require("i18n-iso-countries/langs/ar.json"))
countries.registerLocale(require("i18n-iso-countries/langs/bg.json"))
countries.registerLocale(require("i18n-iso-countries/langs/bn.json"))
countries.registerLocale(require("i18n-iso-countries/langs/ca.json"))
countries.registerLocale(require("i18n-iso-countries/langs/cs.json"))
countries.registerLocale(require("i18n-iso-countries/langs/de.json"))
countries.registerLocale(require("i18n-iso-countries/langs/el.json"))
countries.registerLocale(require("i18n-iso-countries/langs/en.json"))
// No translation for eo
countries.registerLocale(require("i18n-iso-countries/langs/es.json"))
countries.registerLocale(require("i18n-iso-countries/langs/et.json"))
countries.registerLocale(require("i18n-iso-countries/langs/fa.json"))
countries.registerLocale(require("i18n-iso-countries/langs/fi.json"))
countries.registerLocale(require("i18n-iso-countries/langs/fr.json"))
countries.registerLocale(require("i18n-iso-countries/langs/hi.json"))
countries.registerLocale(require("i18n-iso-countries/langs/hr.json"))
countries.registerLocale(require("i18n-iso-countries/langs/id.json"))
countries.registerLocale(require("i18n-iso-countries/langs/it.json"))
countries.registerLocale(require("i18n-iso-countries/langs/ja.json"))
countries.registerLocale(require("i18n-iso-countries/langs/lt.json"))
countries.registerLocale(require("i18n-iso-countries/langs/no.json"))
countries.registerLocale(require("i18n-iso-countries/langs/pl.json"))
countries.registerLocale(require("i18n-iso-countries/langs/pt.json"))
countries.registerLocale(require("i18n-iso-countries/langs/ru.json"))
// No translatons for si
countries.registerLocale(require("i18n-iso-countries/langs/ta.json"))
countries.registerLocale(require("i18n-iso-countries/langs/tr.json"))
countries.registerLocale(require("i18n-iso-countries/langs/uk.json"))
countries.registerLocale(require("i18n-iso-countries/langs/vi.json"))
countries.registerLocale(require("i18n-iso-countries/langs/zh.json"))
countries.registerLocale(require("i18n-iso-countries/langs/be.json"))
countries.registerLocale(require("i18n-iso-countries/langs/hu.json"))
countries.registerLocale(require("i18n-iso-countries/langs/nl.json"))
countries.registerLocale(require("i18n-iso-countries/langs/pt.json"))

const Statistics = ({ stats }: { stats: Statistics }): JSX.Element => {
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

    const translation = `${translatedCountryName ??
      countries.getName(countryCode, "en") ??
      t("unknown")
      }: ${downloadTranslation}`

    return translation
  }

  return (
    <>
      <NextSeo title={t("statistics")} description={t("flathub-statistics")} />
      <div className="max-w-11/12 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1>{t("statistics")}</h1>
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
                header: t("count-desktop-applications"),
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
        <h3>{t("downloads-per-country")}</h3>
        <div className={`flex justify-center ${styles.map}`}>
          <WorldMap
            color="rgb(var(--color-primary))"
            backgroundColor="rgb(var(--bg-color-secondary))"
            borderColor="rgb(var(--text-primary))"
            size="responsive"
            data={country_data}
            tooltipTextFunction={getLocalizedText}
          />
        </div>
        <h3>{t("downloads-over-time")}</h3>
        <div className="h-[500px] rounded-xl bg-flathubWhite dark:bg-flathubJet p-4 shadow-md">
          <Line data={data} options={options} />
        </div>
        <h3>{t("category-distribution")}</h3>
        <div className="h-[500px] rounded-xl bg-flathubWhite dark:bg-flathubJet p-4 shadow-md">
          <Bar
            data={{
              labels: category_data.map((x) =>
                categoryToName(x.category as Category, t),
              ),
              datasets: [
                {
                  data: category_data.map((x) => x.value),
                  backgroundColor: ["hsl(212.9, 58.1%, 55.1%)"],
                },
              ],
            }}
            options={barOptions}
          />
        </div>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  console.log("Fetching data for stats")
  const stats = await fetchStats()

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      stats,
    },
    revalidate: 900,
  }
}

export default Statistics
