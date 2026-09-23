import { notFound } from "next/navigation"
import { getVerifiedCollectionVerifiedGet } from "../../../../../../src/codegen"
import { Metadata } from "next"
import VerifiedCollectionClient from "./verified-collection-client"
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
    title: t("verified-apps"),
    description: t("verified-apps-description"),
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/apps/collection/verified/${page}`,
    },
  }
}

export default async function VerifiedCollectionPage({ params }: Props) {
  const { page, locale } = await params

  const pageNum = parsePositivePageNumber(page)

  if (pageNum === null) {
    notFound()
  }

  const response = await getVerifiedCollectionVerifiedGet({
    page: pageNum,
    per_page: 30,
    locale,
  })
  const applications = response.data

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <VerifiedCollectionClient applications={applications} />
}
