import { notFound } from "next/navigation"
import fetchCollection from "../../../../../../src/fetchers"
import { Metadata } from "next"
import MobileCollectionClient from "./mobile-collection-client"
import { getTranslations, setRequestLocale } from "next-intl/server"

interface Props {
  params: Promise<{
    page: string
    locale: string
  }>
}

export const dynamic = "force-static"
export const revalidate = 3600 // Revalidate every hour

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("mobile-apps"),
  }
}

export default async function MobileCollectionPage({ params }: Props) {
  const { locale, page } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const pageNum = parseInt(page)

  if (isNaN(pageNum)) {
    notFound()
  }

  const applications = await fetchCollection("mobile", pageNum, 30, locale)

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <MobileCollectionClient applications={applications} />
}
