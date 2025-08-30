import { notFound } from "next/navigation"
import fetchCollection from "../../../../../../src/fetchers"
import { translationMessages } from "../../../../../../i18n/request"
import { Metadata } from "next"
import RecentlyUpdatedCollectionClient from "./recently-updated-collection-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: {
    page: string
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations()
  
  return {
    title: t("recently-updated-apps"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/collection/recently-updated`,
    },
    robots: params.locale === "en-GB" ? { index: false } : undefined,
  }
}

export default async function RecentlyUpdatedCollectionPage({ params }: Props) {
  const pageNum = parseInt(params.page)
  
  if (isNaN(pageNum)) {
    notFound()
  }

  const [applications, messages] = await Promise.all([
    fetchCollection("recently-updated", pageNum, 30, params.locale),
    translationMessages(params.locale),
  ])

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return (
    <RecentlyUpdatedCollectionClient 
      applications={applications} 
      locale={params.locale}
      messages={messages}
    />
  )
}
