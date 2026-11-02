"use client"

import { useTranslations } from "next-intl"
import Breadcrumbs from "../../../../../../../../src/components/Breadcrumbs"
import ApplicationCollectionSuspense from "../../../../../../../../src/components/application/ApplicationCollectionSuspense"
import type { AppstreamListItem } from "src/types/Appstream"
import {
  tryParseCategory,
  tryParseSubCategory,
} from "../../../../../../../../src/types/Category"
import type { MainCategory } from "../../../../../../../../src/codegen"

interface Props {
  applications: AppstreamListItem[]
  totalPages: number
  totalHits: number
  mainCategory: string
  subcategory: string
  page: number
}

export default function SubcategoryPageClient({
  applications,
  totalPages,
  totalHits,
  mainCategory,
  subcategory,
  page,
}: Props) {
  const t = useTranslations()

  const category = mainCategory as MainCategory
  let categoryName = tryParseCategory(category, t)
  let subcategoryName =
    tryParseSubCategory(subcategory, t) ?? t(subcategory.toLowerCase())

  const pages = [
    {
      name: categoryName,
      href: `/apps/category/${category}`,
      current: false,
    },
    {
      name: subcategoryName,
      href: `/apps/category/${category}/subcategories/${subcategory}`,
      current: true,
    },
  ]

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 space-y-12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <Breadcrumbs pages={pages} />

      <ApplicationCollectionSuspense
        title={subcategoryName}
        applications={applications}
        page={page}
        totalPages={totalPages}
        totalHits={totalHits}
      />
    </div>
  )
}
