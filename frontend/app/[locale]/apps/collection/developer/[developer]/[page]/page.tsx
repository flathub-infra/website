import { notFound } from "next/navigation"
import { fetchDeveloperApps } from "../../../../../../../src/fetchers"
import { translationMessages } from "../../../../../../../i18n/request"
import { Metadata } from "next"
import DeveloperCollectionClient from "./developer-collection-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: {
    developer: string
    page: string
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations()
  const developer = decodeURIComponent(params.developer)

  return {
    title: t("apps-by-developer", { developer }),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/collection/developer/${params.developer}`,
    },
    robots: params.locale === "en-GB" ? { index: false } : undefined,
  }
}

export default async function DeveloperCollectionPage({ params }: Props) {
  const pageNum = parseInt(params.page)

  if (isNaN(pageNum)) {
    notFound()
  }

  const developer = decodeURIComponent(params.developer)
  const [applications, messages] = await Promise.all([
    fetchDeveloperApps(developer, params.locale, pageNum, 30),
    translationMessages(params.locale),
  ])

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return (
    <DeveloperCollectionClient
      applications={applications}
      developer={developer}
      locale={params.locale}
      messages={messages}
    />
  )
}
