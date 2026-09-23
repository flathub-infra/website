import { notFound } from "next/navigation"
import { getRecentlyAddedCollectionRecentlyAddedGet } from "../../../../../../src/codegen"
import { Metadata } from "next"
import RecentlyAddedCollectionClient from "./recently-added-collection-client"
import { getTranslations } from "next-intl/server"
import { parsePositivePageNumber } from "@/utils/page-number"

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
  const { locale, page } = await params
  const t = await getTranslations()

  return {
    title: t("new-apps"),
    description: t("new-description"),
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/apps/collection/recently-added/${page}`,
    },
  }
}

export default async function RecentlyAddedCollectionPage({ params }: Props) {
  const { locale, page } = await params

  const pageNum = parsePositivePageNumber(page)

  if (pageNum === null) {
    notFound()
  }

  const response = await getRecentlyAddedCollectionRecentlyAddedGet({
    page: pageNum,
    per_page: 30,
    locale,
  })
  const applications = response.data

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <RecentlyAddedCollectionClient applications={applications} />
}
