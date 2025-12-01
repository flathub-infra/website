import { notFound } from "next/navigation"
import { getRecentlyUpdatedCollectionRecentlyUpdatedGet } from "../../../../../../src/codegen"
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
export const revalidate = 3600 // Revalidate every hour

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, page } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("updated-apps"),
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/apps/collection/recently-updated/${page}`,
    },
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

  const response = await getRecentlyUpdatedCollectionRecentlyUpdatedGet({
    page: pageNum,
    per_page: 30,
    locale,
  })
  const applications = response.data

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <RecentlyUpdatedCollectionClient applications={applications} />
}
