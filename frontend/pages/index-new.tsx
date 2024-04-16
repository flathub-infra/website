import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import {
  fetchAppstream,
  fetchCategory,
  fetchCollectionRecentlyAdded,
  fetchCollectionRecentlyUpdated,
  fetchCollectionTrendingLastTwoWeeks,
  fetchCollectionVerified,
} from "../src/fetchers"
import { APPS_IN_PREVIEW_COUNT, IS_PRODUCTION } from "../src/env"
import { NextSeo } from "next-seo"
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
import { formatISO } from "date-fns"
import LoginGuard from "src/components/login/LoginGuard"
import {
  getAppOfTheDayAppPicksAppOfTheDayDateGet,
  getAppOfTheWeekAppPicksAppsOfTheWeekDateGet,
} from "src/codegen"
import { Permission, UserInfo } from "src/codegen"
import { useState } from "react"
import MultiToggle from "src/components/MultiToggle"

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

const CategorySection = ({
  topAppsByCategory,
}: {
  topAppsByCategory: {
    category: Category
    apps: MeilisearchResponse<AppsIndex>
  }[]
}) => {
  const { t } = useTranslation()

  const [selectedCategory, setSelectedCategory] = useState(
    topAppsByCategory[0].category,
  )

  const selectedApps = topAppsByCategory.find(
    (sectionData) => sectionData.category === selectedCategory,
  )

  return (
    <ApplicationSection
      key={`categorySection${selectedApps.category}`}
      href={`/apps/category/${encodeURIComponent(selectedCategory)}`}
      applications={selectedApps.apps.hits.map((app) =>
        mapAppsIndexToAppstreamListItem(app),
      )}
      appSelection={
        <>
          <MultiToggle
            items={topAppsByCategory.map((x) => ({
              id: x.category,
              content: (
                <div className="font-semibold">
                  {categoryToName(x.category, t)}
                </div>
              ),
              selected: x.category === selectedCategory,
              onClick: () => setSelectedCategory(x.category),
            }))}
            size={"lg"}
            variant="secondary"
          />
        </>
      }
      title={categoryToName(selectedApps.category, t)}
      morePosition="bottom"
    />
  )
}

const TopSection = ({
  topApps,
}: {
  topApps: {
    name: string
    apps: MeilisearchResponse<AppsIndex>
    moreLink: string
  }[]
}) => {
  const { t } = useTranslation()

  const [selectedName, setSelectedName] = useState(topApps[0].name)

  const selectedApps = topApps.find(
    (sectionData) => sectionData.name === selectedName,
  )

  return (
    <ApplicationSection
      key={`topSection${selectedApps.name}`}
      href={selectedApps.moreLink}
      applications={selectedApps.apps.hits.map((app) =>
        mapAppsIndexToAppstreamListItem(app),
      )}
      appSelection={
        <>
          <MultiToggle
            items={topApps.map((x) => ({
              id: x.name,
              content: <div className="font-semibold">{t(x.name)}</div>,
              selected: x.name === selectedName,
              onClick: () => setSelectedName(x.name),
            }))}
            size={"lg"}
            variant="secondary"
          />
        </>
      }
      title={t(selectedApps.name)}
      morePosition="bottom"
    />
  )
}

export default function Home({
  recentlyUpdated,
  recentlyAdded,
  trending,
  verified,
  topAppsByCategory,
  heroBannerData,
  appOfTheDayAppstream,
}: {
  recentlyUpdated: MeilisearchResponse<AppsIndex>
  recentlyAdded: MeilisearchResponse<AppsIndex>
  trending: MeilisearchResponse<AppsIndex>
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
      <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard
          condition={(info: UserInfo) =>
            info.permissions.some((a) => a === Permission["quality-moderation"])
          }
        >
          <div className="space-y-4">
            {heroBannerData.length > 0 && (
              <HeroBanner heroBannerData={heroBannerData} />
            )}
            <div className="flex flex-col lg:flex-row gap-4">
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
          </div>

          <TopSection
            topApps={[
              {
                apps: trending,
                name: "trending",
                moreLink: "/apps/collection/trending",
              },
              {
                apps: recentlyAdded,
                name: "new",
                moreLink: "/apps/collection/recently-added",
              },
              {
                apps: recentlyUpdated,
                name: "updated",
                moreLink: "/apps/collection/recently-updated",
              },

              {
                apps: verified,
                name: "verified",
                moreLink: "/apps/collection/verified",
              },
            ]}
          />

          <CategorySection topAppsByCategory={topAppsByCategory.slice(0, 3)} />
          <CategorySection topAppsByCategory={topAppsByCategory.slice(3, 6)} />
          <CategorySection topAppsByCategory={topAppsByCategory.slice(6, 10)} />
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
  const { data: trending } = await fetchCollectionTrendingLastTwoWeeks(
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
        apps: (await fetchCategory(category, 1, 12)).data,
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

  const heroBannerApps = await getAppOfTheWeekAppPicksAppsOfTheWeekDateGet(
    formatISO(new Date(), { representation: "date" }),
  )
  const appOfTheDay = await getAppOfTheDayAppPicksAppOfTheDayDateGet(
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
      trending,
      verified,
      topAppsByCategory,
      heroBannerData,
      appOfTheDayAppstream,
    },
    revalidate: 900,
  }
}
