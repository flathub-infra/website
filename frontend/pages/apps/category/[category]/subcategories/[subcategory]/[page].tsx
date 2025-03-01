import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import Breadcrumbs from "src/components/Breadcrumbs"

import ApplicationCollection from "../../../../../../src/components/application/Collection"
import {
  fetchGameEmulatorCategory,
  fetchGamePackageManagerCategory,
  fetchGameUtilityCategory,
  fetchSubcategory,
} from "../../../../../../src/fetchers"
import {
  gameCategoryFilter,
  tryParseCategory,
  tryParseSubCategory,
} from "../../../../../../src/types/Category"
import { mapAppsIndexToAppstreamListItem } from "src/meilisearch"
import { MainCategory, MeilisearchResponseAppsIndex, SortBy } from "src/codegen"

const ApplicationCategory = ({
  applications,
  locale,
}: {
  applications: MeilisearchResponseAppsIndex
  locale: string
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const category = router.query.category as MainCategory
  let categoryName = tryParseCategory(category, t)
  const subcategory = router.query.subcategory as string
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
    <>
      <NextSeo
        title={subcategoryName}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/category/${category}/subcategories/${subcategory}`,
        }}
        noindex={locale === "en-GB"}
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

  const mainCategory = params.category as keyof typeof MainCategory
  const subcategory = params.subcategory as string

  let applications = null
  if (subcategory === "Emulator") {
    applications = await fetchGameEmulatorCategory(
      locale,
      params.page as unknown as number,
      30,
    )
  } else if (subcategory === "Launcher") {
    applications = await fetchGamePackageManagerCategory(
      locale,
      params.page as unknown as number,
      30,
    )
  } else if (subcategory === "Tool") {
    applications = await fetchGameUtilityCategory(
      locale,
      params.page as unknown as number,
      30,
    )
  } else {
    applications = await fetchSubcategory(
      mainCategory,
      [subcategory],
      locale,
      params.page as unknown as number,
      30,
      mainCategory === "game" ? gameCategoryFilter : [],
      SortBy.trending,
    )
  }

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
      locale,
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
