import { notFound } from "next/navigation"
import fetchCollection from "../../../../../../src/fetchers"
import { Metadata } from "next"
import VerifiedCollectionClient from "./verified-collection-client"
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
    title: t("verified-apps"),
  }
}

export default async function VerifiedCollectionPage({ params }: Props) {
  const { page, locale } = await params
  const pageNum = parseInt(page)

  if (isNaN(pageNum)) {
    notFound()
  }

  const applications = await fetchCollection("verified", pageNum, 30, locale)

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <VerifiedCollectionClient applications={applications} />
}
