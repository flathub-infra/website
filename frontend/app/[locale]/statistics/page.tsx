import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getIntlLocale } from "../../../src/localize"
import {
  getRuntimeListRuntimesGet,
  getStatsStatsGet,
} from "../../../src/codegen"
import StatisticsClient from "./statistics-client"

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations()

  return {
    title: t("statistics"),
    description: t("flathub-statistics-description"),
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/statistics`,
    },
  }
}

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  try {
    const [statsResponse, runtimesResponse] = await Promise.all([
      getStatsStatsGet().catch((error) => {
        console.error("Failed to fetch stats:", error)
        return null
      }),
      getRuntimeListRuntimesGet().catch((error) => {
        console.error("Failed to fetch runtimes:", error)
        return null
      }),
    ])

    // If both API calls failed, show 404
    if (!statsResponse && !runtimesResponse) {
      notFound()
    }

    const stats = statsResponse?.data || {
      totals: { downloads: 0, updates: 0, apps: 0 },
      countries: {},
      downloads_per_day: {},
      updates_per_day: {},
      delta_downloads_per_day: {},
      category_totals: [],
    }

    const runtimes = runtimesResponse?.data || {}
    const t = await getTranslations()
    const language = getIntlLocale(locale).language
    const regionNames = new Intl.DisplayNames(language, { type: "region" })
    const fallbackRegionNames = new Intl.DisplayNames("en", { type: "region" })
    const countryNames = Object.fromEntries(
      Object.keys(stats.countries ?? {}).map((countryCode) => [
        countryCode,
        regionNames.of(countryCode) ??
          fallbackRegionNames.of(countryCode) ??
          t("unknown"),
      ]),
    )

    return (
      <StatisticsClient
        stats={stats}
        runtimes={runtimes}
        locale={locale}
        countryNames={countryNames}
      />
    )
  } catch (error) {
    console.error("Unexpected error in statistics page:", error)
    notFound()
  }
}
