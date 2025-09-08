import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import {
  fetchCategory,
  fetchGameCategory,
} from "../../../../../../src/fetchers"
import {
  categoryToName,
  stringToCategory,
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
  params: Promise<{ category: string; page: string }>
}): Promise<Metadata> {
  const { category: categoryParam } = await params
  const t = await getTranslations()

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

  const category = stringToCategory(categoryParam)
  const page = parseInt(pageParam)

  if (!category) {
    notFound()
  }

  if (isNaN(page) || page < 1) {
    notFound()
  }

  try {
    let applications
    if (category === "game") {
      applications = await fetchGameCategory(locale, page, 30)
    } else {
      applications = await fetchCategory(
        category,
        locale,
        page,
        30,
        [],
        SortBy.trending,
      )
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
  } catch (error) {
    console.error("Error fetching category data:", error)
    notFound()
  }
}
