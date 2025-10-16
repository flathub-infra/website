import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { getCategoryCollectionCategoryCategoryGet } from "../../../../../../src/codegen"
import {
  categoryToName,
  stringToCategory,
  gameCategoryFilter,
} from "../../../../../../src/types/Category"
import { SortBy } from "../../../../../../src/codegen"
import CategoryPageClient from "./category-page-client"

export async function generateStaticParams() {
  // Return empty array to enable ISR for all category/page combinations
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; page: string; locale: string }>
}): Promise<Metadata> {
  const { category: categoryParam, locale } = await params
  const t = await getTranslations({ locale })

  const category = stringToCategory(categoryParam)
  const title = category ? categoryToName(category, t) : categoryParam

  return {
    title,
  }
}

export default async function CategoryPagePaginated({
  params,
}: {
  params: Promise<{ locale: string; category: string; page: string }>
}) {
  const { locale, category: categoryParam, page: pageParam } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const category = stringToCategory(categoryParam)
  const page = parseInt(pageParam)

  if (!category) {
    notFound()
  }

  if (isNaN(page) || page < 1) {
    notFound()
  }

  let applications
  if (category === "game") {
    const response = await getCategoryCollectionCategoryCategoryGet(category, {
      page,
      per_page: 30,
      locale,
      exclude_subcategories: gameCategoryFilter,
      sort_by: SortBy.trending,
    })
    applications = response.data
  } else {
    const response = await getCategoryCollectionCategoryCategoryGet(category, {
      page,
      per_page: 30,
      locale,
      sort_by: SortBy.trending,
    })
    applications = response.data
  }

  // If there are no applications in this category, return 404
  if (!applications.totalHits) {
    notFound()
  }

  if (applications.page > applications.totalPages) {
    notFound()
  }

  return (
    <CategoryPageClient
      applications={applications}
      locale={locale}
      category={category}
    />
  )
}
