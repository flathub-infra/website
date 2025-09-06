import { notFound } from "next/navigation"
import fetchCollection from "../../../../../../src/fetchers"
import { Metadata } from "next"
import MobileCollectionClient from "./mobile-collection-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: Promise<{
    page: string
    locale: string
  }>
}

export async function generateStaticParams() {
  return []
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("mobile-apps"),
  }
}

export default async function MobileCollectionPage({ params }: Props) {
  const { locale, page } = await params
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
