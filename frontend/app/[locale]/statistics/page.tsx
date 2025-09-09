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
      getStatsStatsGet(),
      getRuntimeListRuntimesGet(),
    ])

    const stats = statsResponse.data
    const runtimes = runtimesResponse.data

    return (
      <StatisticsClient stats={stats} runtimes={runtimes} locale={locale} />
    )
  } catch (error) {
    notFound()
  }
}
