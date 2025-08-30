import { notFound } from "next/navigation"
import fetchCollection from "../../../../../../src/fetchers"
import { translationMessages } from "../../../../../../i18n/request"
import { Metadata } from "next"
import RecentlyAddedCollectionClient from "./recently-added-collection-client"
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
    title: t("new-apps"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/collection/recently-added`,
    },
    robots: params.locale === "en-GB" ? { index: false } : undefined,
  }
}

export default async function RecentlyAddedCollectionPage({ params }: Props) {
  const pageNum = parseInt(params.page)
  
  if (isNaN(pageNum)) {
    notFound()
  }

  const [applications, messages] = await Promise.all([
    fetchCollection("recently-added", pageNum, 30, params.locale),
    translationMessages(params.locale),
  ])

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return (
    <RecentlyAddedCollectionClient 
      applications={applications} 
      locale={params.locale}
      messages={messages}
    />
  )
}
