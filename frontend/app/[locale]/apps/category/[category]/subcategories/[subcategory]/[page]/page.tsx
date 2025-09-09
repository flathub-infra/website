import { Metadata } from "next"
import { notFound } from "next/navigation"
import { SortBy } from "../../../../../../../../src/codegen"
import {
  fetchSubcategory,
  fetchGameUtilityCategory,
  fetchGameEmulatorCategory,
  fetchGamePackageManagerCategory,
} from "../../../../../../../../src/fetchers"
import {
  gameCategoryFilter,
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
      applications = await fetchGameEmulatorCategory(locale, page, 30)
    } else if (subcategory === "Launcher") {
      applications = await fetchGamePackageManagerCategory(locale, page, 30)
    } else if (subcategory === "Tool") {
      applications = await fetchGameUtilityCategory(locale, page, 30)
    } else {
      applications = await fetchSubcategory(
        mainCategory,
        [subcategory],
        locale,
        page,
        30,
        mainCategory === "game" ? gameCategoryFilter : [],
        SortBy.trending,
      )
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
