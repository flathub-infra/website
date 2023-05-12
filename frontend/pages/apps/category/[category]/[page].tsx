import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import Breadcrumbs from "src/components/Breadcrumbs"

import ApplicationCollection from "../../../../src/components/application/Collection"
import { fetchCategories, fetchCategory } from "../../../../src/fetchers"
import {
  Category,
  categoryToName,
  getSubcategory,
  subcategoryToName,
  stringToCategory,
} from "../../../../src/types/Category"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import Link from "next/link"
import Tile from "src/components/Tile"

const ApplicationCategory = ({
  applications,
}: {
  applications: MeilisearchResponse<AppsIndex>
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const category = stringToCategory(router.query.category as string)
  let title = categoryToName(category, t)

  const pages = [
    {
      name: title,
      href: `/apps/category/${category}`,
      current: true,
    },
  ]

  const subcategories = getSubcategory(category)

  return (
    <>
      <NextSeo
        title={title}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/category/${category}`,
        }}
      />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 space-y-12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <Breadcrumbs pages={pages} />

        {subcategories && (
          <div>
            <div className="grid grid-cols-[repeat(auto-fill,_minmax(125px,_1fr))] gap-2">
              {getSubcategory(category).map((subcategory) => (
                <Link
                  key={subcategory}
                  href={`/apps/category/${category}/subcategories/${subcategory}`}
                  passHref
                  legacyBehavior
                >
                  <Tile>{subcategoryToName(category, subcategory, t)}</Tile>
                </Link>
              ))}
            </div>
          </div>
        )}

        <ApplicationCollection
          title={title}
          applications={applications.hits.map(mapAppsIndexToAppstreamListItem)}
          page={applications.page}
          totalPages={applications.totalPages}
          totalHits={applications.totalHits}
        />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale, params }) => {
  const category = stringToCategory(params.category as string)

  if (!category) {
    return {
      notFound: true,
    }
  }

  if (isNaN(params.page as unknown as number)) {
    return {
      notFound: true,
    }
  }

  const applications = await fetchCategory(
    category,
    params.page as unknown as number,
    30,
  )

  // If there are no applications in this category, return 404
  if (!applications.totalHits) {
    return {
      notFound: true,
    }
  }

  if (applications.page > applications.totalPages) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      applications,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const categories = await fetchCategories()

  async function getCategoryAsync(category: Category) {
    return { category: category, data: await fetchCategory(category, 1, 30) }
  }

  const pagesByCategoriesPromises = categories.map(getCategoryAsync)

  const pagesByCategories = await Promise.all(pagesByCategoriesPromises)

  let paths: { params: { category: string; page?: string } }[] = []
  pagesByCategories.forEach((app) => {
    for (let i = 1; i <= app.data.totalPages; i++) {
      paths.push({ params: { category: app.category, page: i.toString() } })
    }
  })

  return {
    paths: paths,
    fallback: "blocking",
  }
}

export default ApplicationCategory
