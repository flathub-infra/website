import fetchCollection, {
  fetchAppOfTheDay,
  fetchAppsOfTheWeek,
  fetchAppstream,
  fetchCategory,
  fetchGameCategory,
  fetchGameEmulatorCategory,
  fetchGamePackageManagerCategory,
  fetchGameUtilityCategory,
} from "../../../src/fetchers"
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
    fetchCollection("recently-updated", 1, APPS_IN_PREVIEW_COUNT * 2, locale),
    fetchCollection("popular", 1, APPS_IN_PREVIEW_COUNT, locale),
    fetchCollection("recently-added", 1, APPS_IN_PREVIEW_COUNT, locale),
    fetchCollection("trending", 1, APPS_IN_PREVIEW_COUNT, locale),
    fetchCollection("mobile", 1, 6, locale),
  ])

  // Check for any errors and throw to trigger regeneration
  for (const result of results) {
    if (result && "error" in result) {
      throw new Error(`Collection fetch error: ${result.error}`)
    }
  }

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
      const appsResult = await fetchCategory(
        category,
        locale,
        1,
        6,
        [],
        SortBy.trending,
      )

      if ("error" in appsResult) {
        throw new Error(
          `Category fetch error for ${category}: ${appsResult.error}`,
        )
      }

      return {
        category,
        apps: appsResult,
      }
    })

  return await Promise.all(categoryPromises)
}

async function getHeroBanner(dateString: string, locale: string) {
  const [heroBannerApps, appOfTheDay] = await Promise.all([
    fetchAppsOfTheWeek(dateString),
    fetchAppOfTheDay(dateString),
  ])

  // Check for errors and throw to trigger regeneration
  if ("error" in heroBannerApps) {
    throw new Error(`Hero banner apps fetch error: ${heroBannerApps.error}`)
  }

  if ("error" in appOfTheDay) {
    throw new Error(`App of the day fetch error: ${appOfTheDay.error}`)
  }

  // Fetch appstream data for hero banner
  const heroBannerAppstreams = await Promise.all(
    heroBannerApps.apps.map(async (app) => fetchAppstream(app.app_id, locale)),
  )

  // Check for any appstream fetch errors
  for (const appstream of heroBannerAppstreams) {
    if ("error" in appstream) {
      throw new Error(`Hero banner appstream fetch error: ${appstream.error}`)
    }
  }

  const heroBannerData = heroBannerApps.apps.map((app) => ({
    app: app,
    appstream: (heroBannerAppstreams as Appstream[]).find(
      (a) => a.id === app.app_id,
    ) as DesktopAppstream,
  }))

  const appOfTheDayAppstreamResult = await fetchAppstream(
    appOfTheDay.app_id,
    locale,
  )

  if ("error" in appOfTheDayAppstreamResult) {
    throw new Error(
      `App of the day appstream fetch error: ${appOfTheDayAppstreamResult.error}`,
    )
  }

  return {
    heroBannerData,
    appOfTheDayAppstream: appOfTheDayAppstreamResult as DesktopAppstream,
  }
}

async function getGameData(locale: string) {
  const results = await Promise.all([
    fetchGameCategory(locale, 1, 12),
    fetchGameEmulatorCategory(locale, 1, 12),
    fetchGamePackageManagerCategory(locale, 1, 12),
    fetchGameUtilityCategory(locale, 1, 12),
  ])

  // Check for any errors and throw to trigger regeneration
  for (const result of results) {
    if (result && "error" in result) {
      throw new Error(`Game data fetch error: ${result.error}`)
    }
  }

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

  // Remove duplicated apps from recently updated
  const filteredRecentlyUpdated = {
    ...recentlyUpdated,
    hits: recentlyUpdated.hits
      .filter(
        (app) => !recentlyAdded.hits.some((addedApp) => addedApp.id === app.id),
      )
      .slice(0, APPS_IN_PREVIEW_COUNT),
  }

  return (
    <HomeClient
      recentlyUpdated={filteredRecentlyUpdated}
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
