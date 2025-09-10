import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import {
  getRuntimeListRuntimesGet,
  getStatsStatsGet,
} from "../../../src/codegen"
import StatisticsClient from "./statistics-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("statistics"),
    description: t("flathub-statistics-description"),
  }
}

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

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

    return (
      <StatisticsClient stats={stats} runtimes={runtimes} locale={locale} />
    )
  } catch (error) {
    console.error("Unexpected error in statistics page:", error)
    notFound()
  }
}
