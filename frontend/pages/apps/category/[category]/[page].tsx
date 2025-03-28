import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import Breadcrumbs from "src/components/Breadcrumbs"

import ApplicationCollection from "../../../../src/components/application/Collection"
import { fetchCategory, fetchGameCategory } from "../../../../src/fetchers"
import {
  categoryToName,
  getSubcategory,
  stringToCategory,
  tryParseSubCategory,
} from "../../../../src/types/Category"
import { mapAppsIndexToAppstreamListItem } from "src/meilisearch"
import Link from "next/link"
import Tile from "src/components/Tile"
import { MeilisearchResponseAppsIndex, SortBy } from "src/codegen"

const ApplicationCategory = ({
  applications,
  locale,
}: {
  applications: MeilisearchResponseAppsIndex
  locale: string
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
        noindex={locale === "en-GB"}
      />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 space-y-12 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <Breadcrumbs pages={pages} />

        {subcategories && (
          <div>
            <div className="flex flex-wrap gap-2">
              {getSubcategory(category).map((subcategory) => (
                <Link
                  key={subcategory}
                  href={`/apps/category/${category}/subcategories/${subcategory}`}
                  passHref
                  legacyBehavior
                >
                  <Tile>{tryParseSubCategory(subcategory, t)}</Tile>
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
      revalidate: 60,
    }
  }

  if (isNaN(params.page as unknown as number)) {
    return {
      notFound: true,
      revalidate: 60,
    }
  }

  let applications = null
  if (category === "game") {
    applications = await fetchGameCategory(
      locale,
      params.page as unknown as number,
      30,
    )
  } else {
    applications = await fetchCategory(
      category,
      locale,
      params.page as unknown as number,
      30,
      [],
      SortBy.trending,
    )
  }

  // If there are no applications in this category, return 404
  if (!applications.totalHits) {
    return {
      notFound: true,
      revalidate: 60,
    }
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
