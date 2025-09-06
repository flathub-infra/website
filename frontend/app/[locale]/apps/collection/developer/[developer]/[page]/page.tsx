import { notFound } from "next/navigation"
import { fetchDeveloperApps } from "../../../../../../../src/fetchers"
import { Metadata } from "next"
import DeveloperCollectionClient from "./developer-collection-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: Promise<{
    developer: string
    page: string
    locale: string
  }>
}

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, developer } = await params
  const t = await getTranslations()
  const developerDecoded = decodeURIComponent(developer)

  return {
    title: t("apps-by-developer", { developer: developerDecoded }),
  }
}

export default async function DeveloperCollectionPage({ params }: Props) {
  const { locale, developer, page } = await params
  const pageNum = parseInt(page)

  if (isNaN(pageNum)) {
    notFound()
  }

  const developerDecoded = decodeURIComponent(developer)
  const applications = await fetchDeveloperApps(developer, locale, pageNum, 30)

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return (
    <DeveloperCollectionClient
      applications={applications}
      developer={developerDecoded}
    />
  )
}
