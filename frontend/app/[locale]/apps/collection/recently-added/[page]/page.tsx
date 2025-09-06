import { notFound } from "next/navigation"
import fetchCollection from "../../../../../../src/fetchers"
import { Metadata } from "next"
import RecentlyAddedCollectionClient from "./recently-added-collection-client"
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
    title: t("new-apps"),
  }
}

export default async function RecentlyAddedCollectionPage({ params }: Props) {
  const { locale, page } = await params
  const pageNum = parseInt(page)

  if (isNaN(pageNum)) {
    notFound()
  }

  const applications = await fetchCollection(
    "recently-added",
    pageNum,
    30,
    locale,
  )

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <RecentlyAddedCollectionClient applications={applications} />
}
