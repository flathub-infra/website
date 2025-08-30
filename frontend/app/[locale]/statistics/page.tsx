import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
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
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/statistics`,
    },
    robots: {
      index: locale !== "en-GB",
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
