import { notFound } from "next/navigation"
import fetchCollection from "../../../../../../src/fetchers"
import { Metadata } from "next"
import TrendingCollectionClient from "./trending-collection-client"
import { getTranslations, setRequestLocale } from "next-intl/server"

interface Props {
  params: Promise<{
    page: string
    locale: string
  }>
}

export const dynamic = "force-static"
export const revalidate = 43200 // Revalidate twice per day (12 hours)

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("trending-apps"),
  }
}

export default async function TrendingCollectionPage({ params }: Props) {
  const { locale, page } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const pageNum = parseInt(page)

  if (isNaN(pageNum)) {
    notFound()
  }

  const applications = await fetchCollection("trending", pageNum, 30, locale)

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <TrendingCollectionClient applications={applications} />
}
