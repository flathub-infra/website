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
} from "../../../src/codegen"
import { APPS_IN_PREVIEW_COUNT } from "../../../src/env"
import {
  MainCategory,
  MeilisearchResponseAppsIndex,
  SortBy,
} from "../../../src/codegen"
import { formatISO } from "date-fns"
import { Appstream, DesktopAppstream } from "../../../src/types/Appstream"
import HomeClient from "../home-client"
import { setRequestLocale } from "next-intl/server"
import { languages } from "../../../src/localize"
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
  const params = languages.map((locale) => ({
    locale: locale,
  }))

  return params
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
          sort_by: SortBy.trending,
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

  // Fetch appstream data for hero banner
  const heroBannerAppstreams = await Promise.all(
    heroBannerApps.apps.map(async (app) => {
      const response = await getAppstreamAppstreamAppIdGet(app.app_id, {
        locale,
      })
      return response.data
    }),
  )

  const heroBannerData = heroBannerApps.apps.map((app) => ({
    app: app,
    appstream: heroBannerAppstreams.find(
      (a) => a.id === app.app_id,
    ) as unknown as DesktopAppstream,
  }))

  const appOfTheDayAppstreamResponse = await getAppstreamAppstreamAppIdGet(
    appOfTheDay.app_id,
    { locale },
  )

  return {
    heroBannerData,
    appOfTheDayAppstream: appOfTheDayAppstreamResponse.data,
  }
}

async function getGameData(locale: string) {
  const results = await Promise.all([
    getCategoryCollectionCategoryCategoryGet(MainCategory.game, {
      page: 1,
      per_page: 12,
      locale,
      exclude_subcategories: gameCategoryFilter,
      sort_by: SortBy.trending,
    }).then((r) => r.data),
    getSubcategoryCollectionCategoryCategorySubcategoriesGet(
      MainCategory.game,
      {
        page: 1,
        per_page: 12,
        locale,
        subcategory: ["emulator"],
        sort_by: SortBy.trending,
      },
    ).then((r) => r.data),
    getSubcategoryCollectionCategoryCategorySubcategoriesGet(
      MainCategory.game,
      {
        page: 1,
        per_page: 12,
        locale,
        subcategory: ["packageManager"],
        sort_by: SortBy.trending,
      },
    ).then((r) => r.data),
    getSubcategoryCollectionCategoryCategorySubcategoriesGet(
      MainCategory.game,
      {
        page: 1,
        per_page: 12,
        locale,
        subcategory: ["utility", "network"],
        sort_by: SortBy.trending,
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

  // Fetch all data in parallel
  const [
    [recentlyUpdated, popular, recentlyAdded, trending, mobile],
    topAppsByCategory,
    { heroBannerData, appOfTheDayAppstream },
    [games, emulators, gameLaunchers, gameTools],
  ] = await Promise.all([
    getCollections(locale),
    getCategoryData(locale),
    getHeroBanner(currentDate, locale),
    getGameData(locale),
  ])

  return (
    <HomeClient
      recentlyUpdated={recentlyUpdated}
      recentlyAdded={recentlyAdded}
      trending={trending}
      popular={popular}
      topAppsByCategory={topAppsByCategory}
      heroBannerData={heroBannerData}
      appOfTheDayAppstream={appOfTheDayAppstream as unknown as DesktopAppstream}
      mobile={mobile}
      games={games}
      emulators={emulators}
      gameLaunchers={gameLaunchers}
      gameTools={gameTools}
    />
  )
}
