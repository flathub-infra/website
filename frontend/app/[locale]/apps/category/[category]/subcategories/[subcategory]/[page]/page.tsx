import { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  AppSchemasSortBy,
  getSubcategoryCollectionCategoryCategorySubcategoriesGet,
  MainCategory,
} from "../../../../../../../../src/codegen"
import {
  stringToCategory,
  tryParseSubCategory,
} from "../../../../../../../../src/types/Category"
import SubcategoryPageClient from "./subcategory-page-client"
import { getTranslations, setRequestLocale } from "next-intl/server"

interface Params {
  locale: string
  category: string
  subcategory: string
  page: string
}

interface Props {
  params: Promise<Params>
}

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subcategory, locale } = await params

  const t = await getTranslations({ locale })
  let subcategoryName =
    tryParseSubCategory(subcategory, t) ?? t(subcategory.toLowerCase())

  return {
    title: `${subcategoryName}`,
  }
}

export default async function SubcategoryPage({ params }: Props) {
  const { locale, category, subcategory, page: pageParam } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const page = parseInt(pageParam, 10)

  if (isNaN(page) || page < 1) {
    notFound()
  }

  const mainCategory = stringToCategory(category)
  if (!mainCategory) {
    notFound()
  }

  let applications

  try {
    if (subcategory === "Emulator") {
      const response =
        await getSubcategoryCollectionCategoryCategorySubcategoriesGet(
          MainCategory.game,
          {
            page,
            per_page: 30,
            locale,
            subcategory: ["emulator"],
            sort_by: AppSchemasSortBy.trending,
          },
        )
      applications = response.data
    } else if (subcategory === "Launcher") {
      const response =
        await getSubcategoryCollectionCategoryCategorySubcategoriesGet(
          MainCategory.game,
          {
            page,
            per_page: 30,
            locale,
            subcategory: ["packageManager", "launcherStore"],
            sort_by: AppSchemasSortBy.trending,
          },
        )
      applications = response.data
    } else if (subcategory === "Tool") {
      const response =
        await getSubcategoryCollectionCategoryCategorySubcategoriesGet(
          MainCategory.game,
          {
            page,
            per_page: 30,
            locale,
            subcategory: ["utility", "network", "gameTool"],
            sort_by: AppSchemasSortBy.trending,
          },
        )
      applications = response.data
    } else {
      const response =
        await getSubcategoryCollectionCategoryCategorySubcategoriesGet(
          mainCategory,
          {
            page,
            per_page: 30,
            locale,
            subcategory: [subcategory],
            sort_by: AppSchemasSortBy.trending,
          },
        )
      applications = response.data
    }
  } catch (error) {
    console.error(
      `Error fetching subcategory ${subcategory} in ${category}:`,
      error,
    )
    notFound()
  }

  if (page > applications.totalPages) {
    notFound()
  }

  return (
    <SubcategoryPageClient
      applications={applications}
      mainCategory={category}
      subcategory={subcategory}
      page={page}
    />
  )
}
