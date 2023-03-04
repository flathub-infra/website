import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import Breadcrumbs from "src/components/Breadcrumbs"

import ApplicationCollection from "../../../../src/components/application/Collection"
import { fetchCategories, fetchCategory } from "../../../../src/fetchers"
import { Category, categoryToName } from "../../../../src/types/Category"
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
  let title = categoryToName(category, t)

  const pages = [
    {
      name: t("categories"),
      href: "/apps",
      current: false,
    },
    {
      name: title,
      href: `/apps/category/${category}`,
      current: true,
    },
  ]

  return (
    <>
      <NextSeo title={title} />
      <div className="max-w-11/12 my-0 mx-auto w-11/12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <Breadcrumbs pages={pages} />

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
  if (isNaN(params.page as unknown as number)) {
    return {
      notFound: true,
    }
  }

  const applications = await fetchCategory(
    params.category as keyof typeof Category,
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
