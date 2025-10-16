import { notFound } from "next/navigation"
import { getVerifiedCollectionVerifiedGet } from "../../../../../../src/codegen"
import { Metadata } from "next"
import VerifiedCollectionClient from "./verified-collection-client"
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
    title: t("verified-apps"),
  }
}

export default async function VerifiedCollectionPage({ params }: Props) {
  const { page, locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const pageNum = parseInt(page)

  if (isNaN(pageNum)) {
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
