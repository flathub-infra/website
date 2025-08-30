import { notFound } from "next/navigation"
import {
  getKeywordCollectionKeywordGet,
  MeilisearchResponseAppsIndex,
} from "../../../../../../../src/codegen"
import { translationMessages } from "../../../../../../../i18n/request"
import { Metadata } from "next"
import TagCollectionClient from "./tag-collection-client"
import { getTranslations } from "next-intl/server"
import { AxiosResponse } from "axios"

interface Props {
  params: {
    tag: string
    page: string
    locale: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations()
  const tag = decodeURIComponent(params.tag)

  return {
    title: t("apps-by-tag", { tag }),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/collection/tag/${params.tag}`,
    },
    robots: params.locale === "en-GB" ? { index: false } : undefined,
  }
}

export default async function TagCollectionPage({ params }: Props) {
  const pageNum = parseInt(params.page)

  if (isNaN(pageNum)) {
    notFound()
  }

  const tag = decodeURIComponent(params.tag)
  const [applicationsResponse, messages] = await Promise.all([
    getKeywordCollectionKeywordGet({
      keyword: tag,
      locale: params.locale,
      page: pageNum,
      per_page: 30,
    }) as Promise<AxiosResponse<MeilisearchResponseAppsIndex>>,
    translationMessages(params.locale),
  ])

  const applications = applicationsResponse.data

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return (
    <TagCollectionClient
      applications={applications}
      tag={tag}
      locale={params.locale}
      messages={messages}
    />
  )
}
