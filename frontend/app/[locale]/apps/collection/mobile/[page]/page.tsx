import { notFound } from "next/navigation"
import { getMobileCollectionMobileGet } from "../../../../../../src/codegen"
import { Metadata } from "next"
import MobileCollectionClient from "./mobile-collection-client"
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
    title: t("mobile-apps"),
    description: t("mobile-apps-description"),
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/apps/collection/mobile/${page}`,
    },
  }
}

export default async function MobileCollectionPage({ params }: Props) {
  const { locale, page } = await params

  const pageNum = parsePositivePageNumber(page)

  if (pageNum === null) {
    notFound()
  }

  const response = await getMobileCollectionMobileGet({
    page: pageNum,
    per_page: 30,
    locale,
  })
  const applications = response.data

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <MobileCollectionClient applications={applications} />
}
