import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import fetchCollection, { fetchCategory } from "../src/fetchers"
import { APPS_IN_PREVIEW_COUNT, IS_PRODUCTION } from "../src/env"
import { NextSeo } from "next-seo"
import { Collections } from "../src/types/Collection"
import ApplicationSections from "../src/components/application/Sections"
import { useTranslation } from "next-i18next"
import ButtonLink from "src/components/ButtonLink"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import { Category, categoryToName } from "src/types/Category"
import ApplicationSection from "src/components/application/ApplicationSection"

const categoryOrder = [
  Category.Office,
  Category.Graphics,
  Category.AudioVideo,
  Category.Education,
  Category.Game,
  Category.Network,
  Category.Development,
  Category.Science,
  Category.System,
  Category.Utility,
]

export default function Home({
  recentlyUpdated,
  recentlyAdded,
  popular,
  verified,
  topAppsByCategory,
}: {
  recentlyUpdated: MeilisearchResponse<AppsIndex>
  recentlyAdded: MeilisearchResponse<AppsIndex>
  popular: MeilisearchResponse<AppsIndex>
  verified: MeilisearchResponse<AppsIndex>
  topAppsByCategory: {
    category: Category
    apps: MeilisearchResponse<AppsIndex>
  }[]
}) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("home")} description={t("flathub-description")} />
      <div className="max-w-11/12 mx-auto my-0 mt-12 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="flex justify-between gap-3">
          <div className="prose dark:prose-invert">
            <h1 className="mb-0 text-4xl font-extrabold">
              {t("the-linux-app-store")}
            </h1>
            <p className="introduction mb-8 mt-2 max-w-2xl text-lg font-light">
              {t("flathub-index-description")}
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                variant="secondary"
                href={"/setup"}
                passHref
                aria-label={t("setup-flathub-description")}
              >
                {t("setup-flathub")}
              </ButtonLink>
              {!IS_PRODUCTION && (
                <ButtonLink
                  variant="secondary"
                  href={"/donate"}
                  passHref
                  aria-label={t("donate-to", { project: "Flathub" })}
                >
                  {t("donate-to", { project: "Flathub" })}
                </ButtonLink>
              )}
            </div>
          </div>
        </div>

        <ApplicationSections
          popular={popular}
          recentlyUpdated={recentlyUpdated}
          recentlyAdded={recentlyAdded}
          verified={verified}
        ></ApplicationSections>

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
  const { data: recentlyUpdated } = await fetchCollection(
    Collections.recentlyUpdated,
    1,
    APPS_IN_PREVIEW_COUNT * 2,
  )
  const { data: recentlyAdded } = await fetchCollection(
    Collections.recentlyAdded,
    1,
    APPS_IN_PREVIEW_COUNT,
  )
  const { data: popular } = await fetchCollection(
    Collections.popular,
    1,
    APPS_IN_PREVIEW_COUNT,
  )
  const { data: verified } = await fetchCollection(
    Collections.verified,
    1,
    APPS_IN_PREVIEW_COUNT,
  )

  let topAppsByCategory: {
    category: Category
    apps: MeilisearchResponse<AppsIndex>
  }[] = []

  const categoryPromise = Object.keys(Category).map(
    async (category: Category) => {
      return {
        category,
        apps: (await fetchCategory(category, 1, 6)).data,
      }
    },
  )

  topAppsByCategory = await Promise.all(categoryPromise)

  topAppsByCategory = topAppsByCategory.sort((a, b) => {
    return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
  })

  // remove duplicated apps
  recentlyUpdated.hits = recentlyUpdated.hits
    .filter(
      (app) => !recentlyAdded.hits.some((addedApp) => addedApp.id === app.id),
    )
    .slice(0, APPS_IN_PREVIEW_COUNT)

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      recentlyUpdated,
      recentlyAdded,
      popular,
      verified,
      topAppsByCategory,
    },
    revalidate: 900,
  }
}
