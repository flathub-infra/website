import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import Breadcrumbs from "src/components/Breadcrumbs"

import ApplicationCollection from "../../../../../../src/components/application/Collection"
import { fetchSubcategory } from "../../../../../../src/fetchers"
import {
  categoryToName,
  subcategoryToName,
} from "../../../../../../src/types/Category"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import { MainCategory } from "src/codegen"

const ApplicationCategory = ({
  applications,
}: {
  applications: MeilisearchResponse<AppsIndex>
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const category = router.query.category as MainCategory
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
      revalidate: 60,
    }
  }

  const applications = await fetchSubcategory(
    params.category as keyof typeof MainCategory,
    params.subcategory as string,
    locale,
    params.page as unknown as number,
    30,
  )

  if (applications.page > applications.totalPages) {
    return {
      notFound: true,
      revalidate: 60,
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
  return {
    paths: [],
    fallback: "blocking",
  }
}

export default ApplicationCategory
