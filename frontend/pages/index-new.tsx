import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import {
  fetchAppstream,
  fetchCategory,
  fetchCollectionPopularLastMonth,
  fetchCollectionRecentlyAdded,
  fetchCollectionRecentlyUpdated,
  fetchCollectionVerified,
} from "../src/fetchers"
import { APPS_IN_PREVIEW_COUNT, IS_PRODUCTION } from "../src/env"
import { NextSeo } from "next-seo"
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
import { HeroBanner } from "src/components/application/HeroBanner"
import { DesktopAppstream } from "src/types/Appstream"
import clsx from "clsx"
import { AppOfTheDay } from "src/components/application/AppOfTheDay"
import { appPicks } from "src/api"
import { formatISO } from "date-fns"
import LoginGuard from "src/components/login/LoginGuard"
import { UserInfo } from "src/codegen"

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
  heroBannerData,
  appOfTheDayAppstream,
}: {
  recentlyUpdated: MeilisearchResponse<AppsIndex>
  recentlyAdded: MeilisearchResponse<AppsIndex>
  popular: MeilisearchResponse<AppsIndex>
  verified: MeilisearchResponse<AppsIndex>
  topAppsByCategory: {
    category: Category
    apps: MeilisearchResponse<AppsIndex>
  }[]
  heroBannerData: {
    app: { position: number; app_id: string; isFullscreen: boolean }
    appstream: DesktopAppstream
  }[]
  appOfTheDayAppstream: DesktopAppstream
}) {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo description={t("flathub-description")} />
      <div className="max-w-11/12 mx-auto my-0 mt-12 w-11/12 space-y-4 lg:space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard condition={(info: UserInfo) => info.is_quality_moderator}>
          {heroBannerData.length > 0 && (
            <HeroBanner heroBannerData={heroBannerData} />
          )}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-10">
            <AppOfTheDay
              className="lg:w-1/2"
              appOfTheDay={appOfTheDayAppstream}
            />
            <div
              className={clsx(
                "lg:w-1/2",
                "rounded-xl",
                "flex min-w-0 items-center gap-4",
                "bg-repeat-y",
                "bg-[url('/img/card-background.svg')]",
                "shadow-md",
                "overflow-hidden",
              )}
            >
              <div
                className={clsx(
                  "flex justify-between gap-3",
                  "dark:bg-flathub-arsenic/90",
                  "p-8 w-full h-full",
                )}
              >
                <div className="prose dark:prose-invert max-w-none">
                  <div className="mb-0 text-2xl font-extrabold">
                    {t("flathub-the-linux-app-store")}
                  </div>
                  <p className="introduction mb-4 mt-2 max-w-2xl font-light">
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
              href={`/apps/category/${encodeURIComponent(
                sectionData.category,
              )}`}
              applications={sectionData.apps.hits.map((app) =>
                mapAppsIndexToAppstreamListItem(app),
              )}
              title={categoryToName(sectionData.category, t)}
            />
          ))}
        </LoginGuard>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { data: recentlyUpdated } = await fetchCollectionRecentlyUpdated(
    1,
    APPS_IN_PREVIEW_COUNT * 2,
  )
  const { data: recentlyAdded } = await fetchCollectionRecentlyAdded(
    1,
    APPS_IN_PREVIEW_COUNT,
  )
  const { data: popular } = await fetchCollectionPopularLastMonth(
    1,
    APPS_IN_PREVIEW_COUNT,
  )
  const { data: verified } = await fetchCollectionVerified(
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

  const heroBannerApps =
    await appPicks.getAppOfTheWeekAppPicksAppsOfTheWeekDateGet(
      formatISO(new Date(), { representation: "date" }),
    )
  const appOfTheDay = await appPicks.getAppOfTheDayAppPicksAppOfTheDayDateGet(
    formatISO(new Date(), { representation: "date" }),
  )

  const heroBannerAppstreams = await Promise.all(
    heroBannerApps.data.apps.map(async (app) => fetchAppstream(app.app_id)),
  ).then((apps) => apps.map((app) => app.data))

  const heroBannerData = heroBannerApps.data.apps.map((app) => {
    return {
      app: app,
      appstream: heroBannerAppstreams.find((a) => a.id === app.app_id),
    }
  })

  const appOfTheDayAppstream = await fetchAppstream(
    appOfTheDay.data.app_id,
  ).then((app) => app.data)

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      recentlyUpdated,
      recentlyAdded,
      popular,
      verified,
      topAppsByCategory,
      heroBannerData,
      appOfTheDayAppstream,
    },
    revalidate: 900,
  }
}
