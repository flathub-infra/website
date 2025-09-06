import { notFound } from "next/navigation"
import { getKeywordCollectionKeywordGet } from "../../../../../../../src/codegen"
import { Metadata } from "next"
import TagCollectionClient from "./tag-collection-client"
import { getTranslations } from "next-intl/server"

interface Props {
  params: Promise<{
    tag: string
    page: string
    locale: string
  }>
}

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params
  const t = await getTranslations()
  const tagDecoded = decodeURIComponent(tag)

  return {
    title: t("apps-by-tag", { tag: tagDecoded }),
  }
}

export default async function TagCollectionPage({ params }: Props) {
  const { locale, page, tag } = await params
  const pageNum = parseInt(page)

  if (isNaN(pageNum)) {
    notFound()
  }

  const tagDecoded = decodeURIComponent(tag)
  const applicationsResponse = await getKeywordCollectionKeywordGet({
    keyword: tagDecoded,
    locale: locale,
    page: pageNum,
    per_page: 30,
  })

  const applications = applicationsResponse.data

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return <TagCollectionClient applications={applications} tag={tagDecoded} />
}
