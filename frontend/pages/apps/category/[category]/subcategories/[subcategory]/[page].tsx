import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import Breadcrumbs from "src/components/Breadcrumbs"

import ApplicationCollection from "../../../../../../src/components/application/Collection"
import { fetchSubcategory } from "../../../../../../src/fetchers"
import {
  Category,
  categoryToName,
  getSubcategory,
  subcategoryToName,
} from "../../../../../../src/types/Category"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"

const ApplicationCategory = ({
  applications,
}: {
  applications: MeilisearchResponse<AppsIndex>
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const category = router.query.category as Category
  let categoryName = categoryToName(category, t)
  const subcategory = router.query.subcategory as string
  let subcategoryName = subcategoryToName(category, subcategory, t)

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
    <>
      <NextSeo
        title={subcategoryName}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/category/${category}/subcategories/${subcategory}`,
        }}
      />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 space-y-12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <Breadcrumbs pages={pages} />

        <ApplicationCollection
          title={subcategoryName}
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
  if (isNaN(params.page as unknown as number) || !params.subcategory) {
    return {
      notFound: true,
    }
  }

  const applications = await fetchSubcategory(
    params.category as keyof typeof Category,
    params.subcategory as string,
    params.page as unknown as number,
    30,
  )

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
  const categories = Object.keys(Category) as Category[]

  const subcategories = categories
    .map((category) => {
      return getSubcategory(category)?.map((subcategory) => {
        return {
          category: category,
          subcategory: subcategory,
        }
      })
    })
    .flat()
    .filter((subcategory) => subcategory)

  async function getSubcategoryAsync(subcategory) {
    return {
      category: subcategory.category,
      subcategory: subcategory.subcategory,
      data: await fetchSubcategory(
        subcategory.category,
        subcategory.subcategory,
        1,
        30,
      ),
    }
  }

  const pagesBySubcategoriesPromises = subcategories.map(getSubcategoryAsync)

  const pagesBySubcategories = await Promise.all(pagesBySubcategoriesPromises)

  let paths: {
    params: { category: string; subcategory: string; page?: string }
  }[] = []
  pagesBySubcategories.forEach((app) => {
    for (let i = 1; i <= app.data.totalPages; i++) {
      paths.push({
        params: {
          category: app.category,
          subcategory: app.subcategory,
          page: i.toString(),
        },
      })
    }
  })

  return {
    paths: paths,
    fallback: "blocking",
  }
}

export default ApplicationCategory
