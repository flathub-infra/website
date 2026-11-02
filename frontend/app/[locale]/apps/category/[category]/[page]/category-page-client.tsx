"use client"

import { useTranslations } from "next-intl"
import Breadcrumbs from "../../../../../../src/components/Breadcrumbs"
import ApplicationCollectionSuspense from "../../../../../../src/components/application/ApplicationCollectionSuspense"
import {
  categoryToName,
  getSubcategory,
  tryParseSubCategory,
} from "../../../../../../src/types/Category"
import Tile from "../../../../../../src/components/Tile"
import type { JSX } from "react"
import type { AppstreamListItem } from "src/types/Appstream"
import type { MainCategory } from "../../../../../../src/codegen"

interface CategoryPageClientProps {
  applications: AppstreamListItem[]
  page: number
  totalPages: number
  totalHits: number
  locale: string
  category: MainCategory
}

const CategoryPageClient = ({
  applications,
  page,
  totalPages,
  totalHits,
  locale,
  category,
}: CategoryPageClientProps): JSX.Element => {
  const t = useTranslations()
  const title = categoryToName(category, t)

  const pages = [
    {
      name: title,
      href: `/apps/category/${category}`,
      current: true,
    },
  ]

  const subcategories = getSubcategory(category)

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 space-y-12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <Breadcrumbs pages={pages} />

      {subcategories && (
        <div>
          <div className="flex flex-wrap gap-2">
            {getSubcategory(category).map((subcategory) => (
              <Tile
                key={subcategory}
                href={`/apps/category/${category}/subcategories/${subcategory}`}
              >
                {tryParseSubCategory(subcategory, t)}
              </Tile>
            ))}
          </div>
        </div>
      )}

      <ApplicationCollectionSuspense
        title={title}
        applications={applications}
        page={page}
        totalPages={totalPages}
        totalHits={totalHits}
      />
    </div>
  )
}

export default CategoryPageClient
