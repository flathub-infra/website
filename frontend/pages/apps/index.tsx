import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { fetchCategory } from "../../src/fetchers"
import { APPS_IN_PREVIEW_COUNT } from "../../src/env"
import { NextSeo } from "next-seo"
import Link from "next/link"
import Tile from "../../src/components/Tile"
import { Category, categoryToName } from "../../src/types/Category"
import ApplicationSection from "../../src/components/application/ApplicationSection"
import { useTranslation } from "next-i18next"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"

export default function Apps({
  topAppsByCategory,
}: {
  topAppsByCategory: {
    category: Category
    apps: MeilisearchResponse<AppsIndex>
  }[]
}) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo
        title={t("apps")}
        description={t("apps-description")}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps`,
        }}
      />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div>
          <header>
            <h3>{t("categories")}</h3>
          </header>
          <div className="grid grid-cols-[repeat(auto-fill,_minmax(125px,_1fr))] gap-2">
            {Object.keys(Category).map((category: Category) => (
              <Link
                key={category}
                href={`/apps/category/${encodeURIComponent(category)}`}
                passHref
                legacyBehavior
              >
                <Tile>{categoryToName(category, t)}</Tile>
              </Link>
            ))}
          </div>
        </div>
        {topAppsByCategory.map((sectionData, i) => (
          <ApplicationSection
            key={`categorySection${i}`}
            href={`/apps/category/${encodeURIComponent(sectionData.category)}`}
            applications={sectionData.apps.hits.map((app) =>
              mapAppsIndexToAppstreamListItem(app),
            )}
            title={categoryToName(sectionData.category, t)}
          />
        ))}
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  let topAppsByCategory: {
    category: string
    apps: MeilisearchResponse<AppsIndex>
  }[] = []

  const categoryPromise = Object.keys(Category).map(
    async (category: Category) => {
      return {
        category,
        apps: await fetchCategory(category, 1, APPS_IN_PREVIEW_COUNT),
      }
    },
  )

  topAppsByCategory = await Promise.all(categoryPromise)
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      topAppsByCategory,
    },
    revalidate: 900,
  }
}
