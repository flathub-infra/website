import {
  getPopularLastMonthCollectionPopularGet,
  getAppOfTheDayAppPicksAppOfTheDayDateGet,
  getAppOfTheWeekAppPicksAppsOfTheWeekDateGet,
  getAppstreamAppstreamAppIdGet,
  getCategoryCollectionCategoryCategoryGet,
  getSubcategoryCollectionCategoryCategorySubcategoriesGet,
  getRecentlyUpdatedCollectionRecentlyUpdatedGet,
  getRecentlyAddedCollectionRecentlyAddedGet,
  getTrendingLastTwoWeeksCollectionTrendingGet,
  getMobileCollectionMobileGet,
  AppSchemasSortBy,
  DesktopAppstream,
} from "../../../src/codegen"
import { Metadata } from "next"
import { APPS_IN_PREVIEW_COUNT } from "../../../src/env"
import {
  MainCategory,
  MeilisearchResponseAppsIndex,
} from "../../../src/codegen"
import { formatISO } from "date-fns"
import HomeClient from "../home-client"
import { setRequestLocale } from "next-intl/server"
import { staticLocales } from "../../../src/i18n/static-locales"
import { gameCategoryFilter } from "../../../src/types/Category"

const categoryOrder = [
  MainCategory.office,
  MainCategory.graphics,
  MainCategory.audiovideo,
  MainCategory.education,
  MainCategory.game,
  MainCategory.network,
  MainCategory.development,
  MainCategory.science,
  MainCategory.system,
  MainCategory.utility,
]

export async function generateStaticParams() {
  const params = staticLocales.map((locale) => ({
    locale: locale,
  }))

  return params
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return {
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}`,
    },
  }
}

async function getCollections(locale: string) {
  const results = await Promise.all([
    getRecentlyUpdatedCollectionRecentlyUpdatedGet({
      page: 1,
      per_page: APPS_IN_PREVIEW_COUNT,
      locale,
    }).then((r) => r.data),
    getPopularLastMonthCollectionPopularGet({
      page: 1,
      per_page: APPS_IN_PREVIEW_COUNT,
      locale,
    }).then((r) => r.data),
    getRecentlyAddedCollectionRecentlyAddedGet({
      page: 1,
      per_page: APPS_IN_PREVIEW_COUNT,
      locale,
    }).then((r) => r.data),
    getTrendingLastTwoWeeksCollectionTrendingGet({
      page: 1,
      per_page: APPS_IN_PREVIEW_COUNT,
      locale,
    }).then((r) => r.data),
    getMobileCollectionMobileGet({ page: 1, per_page: 6, locale }).then(
      (r) => r.data,
    ),
  ])

  return results as [
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
  ]
}

async function getCategoryData(locale: string) {
  const categoryPromises = Object.keys(MainCategory)
    .filter((category) => category !== "game")
    .map(async (category: MainCategory) => {
      const appsResult = await getCategoryCollectionCategoryCategoryGet(
        category,
        {
          page: 1,
          per_page: 6,
          locale,
          sort_by: AppSchemasSortBy.trending,
        },
      )

      return {
        category,
        apps: appsResult.data,
      }
    })

  const topAppsByCategory = await Promise.all(categoryPromises)

  // Sort categories according to predefined order
  return topAppsByCategory.sort((a, b) => {
    return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
  })
}

async function getHeroBanner(dateString: string, locale: string) {
  const [heroBannerAppsResponse, appOfTheDayResponse] = await Promise.all([
    getAppOfTheWeekAppPicksAppsOfTheWeekDateGet(dateString),
    getAppOfTheDayAppPicksAppOfTheDayDateGet(dateString),
  ])

  const heroBannerApps = heroBannerAppsResponse.data
  const appOfTheDay = appOfTheDayResponse.data

  const allAppIds = [
    ...heroBannerApps.apps.map((app) => app.app_id),
    appOfTheDay.app_id,
  ]

  const allAppstreams = await Promise.all(
    allAppIds.map((appId) =>
      getAppstreamAppstreamAppIdGet(appId, { locale }).then((r) => r.data),
    ),
  )

  const appstreamMap = new Map(
    allAppstreams.map((appstream) => [appstream.id, appstream]),
  )

  const heroBannerData = heroBannerApps.apps.map((app) => ({
    app: app,
    appstream: appstreamMap.get(app.app_id) as DesktopAppstream,
  }))

  return {
    heroBannerData,
    appOfTheDayAppstream: appstreamMap.get(
      appOfTheDay.app_id,
    ) as DesktopAppstream,
  }
}

async function getGameData(locale: string) {
  const results = await Promise.all([
    getCategoryCollectionCategoryCategoryGet(MainCategory.game, {
      page: 1,
      per_page: 12,
      locale,
      exclude_subcategories: gameCategoryFilter,
      sort_by: AppSchemasSortBy.trending,
    }).then((r) => r.data),
    getSubcategoryCollectionCategoryCategorySubcategoriesGet(
      MainCategory.game,
      {
        page: 1,
        per_page: 12,
        locale,
        subcategory: ["emulator"],
        sort_by: AppSchemasSortBy.trending,
      },
    ).then((r) => r.data),
    getSubcategoryCollectionCategoryCategorySubcategoriesGet(
      MainCategory.game,
      {
        page: 1,
        per_page: 12,
        locale,
        subcategory: ["packageManager", "launcherStore"],
        sort_by: AppSchemasSortBy.trending,
      },
    ).then((r) => r.data),
    getSubcategoryCollectionCategoryCategorySubcategoriesGet(
      MainCategory.game,
      {
        page: 1,
        per_page: 12,
        locale,
        subcategory: ["utility", "network", "gameTool"],
        sort_by: AppSchemasSortBy.trending,
      },
    ).then((r) => r.data),
  ])

  return results as [
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
    MeilisearchResponseAppsIndex,
  ]
}

export const dynamic = "force-static"
export const revalidate = 3600 // Revalidate every hour

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const currentDate = formatISO(new Date(), { representation: "date" })

  // Fetch all data sequentially to reduce backend load during build
  const collections = await getCollections(locale)
  const [recentlyUpdated, popular, recentlyAdded, trending, mobile] =
    collections

  const topAppsByCategory = await getCategoryData(locale)

  const heroBanner = await getHeroBanner(currentDate, locale)
  const { heroBannerData, appOfTheDayAppstream } = heroBanner

  const gameData = await getGameData(locale)
  const [games, emulators, gameLaunchers, gameTools] = gameData

  return (
    <HomeClient
      recentlyUpdated={recentlyUpdated}
      recentlyAdded={recentlyAdded}
      trending={trending}
      popular={popular}
      topAppsByCategory={topAppsByCategory}
      heroBannerData={heroBannerData}
      appOfTheDayAppstream={appOfTheDayAppstream}
      mobile={mobile}
      games={games}
      emulators={emulators}
      gameLaunchers={gameLaunchers}
      gameTools={gameTools}
    />
  )
}
