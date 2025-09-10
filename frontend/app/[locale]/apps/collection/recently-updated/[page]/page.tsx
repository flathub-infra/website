import { notFound } from "next/navigation"
import fetchCollection from "../../../../../../src/fetchers"
import { Metadata } from "next"
import RecentlyUpdatedCollectionClient from "./recently-updated-collection-client"
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
    title: t("updated-apps"),
  }
}

export default async function RecentlyUpdatedCollectionPage({ params }: Props) {
  const { locale, page } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const pageNum = parseInt(page)

  if (isNaN(pageNum)) {
    notFound()
  }

  const applications = await fetchCollection(
    "recently-updated",
    pageNum,
    30,
    locale,
  )

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <RecentlyUpdatedCollectionClient applications={applications} />
}
