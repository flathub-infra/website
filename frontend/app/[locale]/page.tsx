import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import fetchCollection, {
  fetchAppOfTheDay,
  fetchAppsOfTheWeek,
  fetchAppstream,
  fetchCategory,
  fetchGameCategory,
  fetchGameEmulatorCategory,
  fetchGamePackageManagerCategory,
  fetchGameUtilityCategory,
} from "../../src/fetchers"
import { APPS_IN_PREVIEW_COUNT } from "../../src/env"
import { mapAppsIndexToAppstreamListItem } from "../../src/meilisearch"
import {
  MainCategory,
  MeilisearchResponseAppsIndex,
  SortBy,
} from "../../src/codegen"
import { formatISO } from "date-fns"
import { DesktopAppstream } from "../../src/types/Appstream"
import HomeClient from "./home-client"

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

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Fetch all the data needed for the home page
  const [recentlyUpdated, popular, recentlyAdded, trending, mobile] =
    await Promise.all([
      fetchCollection("recently-updated", 1, APPS_IN_PREVIEW_COUNT * 2, locale),
      fetchCollection("popular", 1, APPS_IN_PREVIEW_COUNT, locale),
      fetchCollection("recently-added", 1, APPS_IN_PREVIEW_COUNT, locale),
      fetchCollection("trending", 1, APPS_IN_PREVIEW_COUNT, locale),
      fetchCollection("mobile", 1, 6, locale),
    ])

  // Fetch category data
  const categoryPromises = Object.keys(MainCategory)
    .filter((category) => category !== "game")
    .map(async (category: MainCategory) => ({
      category,
      apps: await fetchCategory(category, locale, 1, 6, [], SortBy.trending),
    }))

  let topAppsByCategory = await Promise.all(categoryPromises)

  // Sort categories according to predefined order
  topAppsByCategory = topAppsByCategory.sort((a, b) => {
    return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
  })

  // Remove duplicated apps from recently updated
  const filteredRecentlyUpdated = {
    ...recentlyUpdated,
    hits: recentlyUpdated.hits
      .filter(
        (app) => !recentlyAdded.hits.some((addedApp) => addedApp.id === app.id),
      )
      .slice(0, APPS_IN_PREVIEW_COUNT),
  }

  // Fetch hero banner and app of the day
  const [heroBannerApps, appOfTheDay] = await Promise.all([
    fetchAppsOfTheWeek(formatISO(new Date(), { representation: "date" })),
    fetchAppOfTheDay(formatISO(new Date(), { representation: "date" })),
  ])

  // Fetch appstream data for hero banner
  const heroBannerAppstreams = await Promise.all(
    heroBannerApps.apps.map(async (app) => fetchAppstream(app.app_id, locale)),
  )

  const heroBannerData = heroBannerApps.apps.map((app) => ({
    app: app,
    appstream: heroBannerAppstreams.find(
      (a) => a.id === app.app_id,
    ) as DesktopAppstream,
  }))

  const appOfTheDayAppstream = (await fetchAppstream(
    appOfTheDay.app_id,
    locale,
  )) as DesktopAppstream

  // Fetch game data
  const [games, emulators, gameLaunchers, gameTools] = await Promise.all([
    fetchGameCategory(locale, 1, 12),
    fetchGameEmulatorCategory(locale, 1, 12),
    fetchGamePackageManagerCategory(locale, 1, 12),
    fetchGameUtilityCategory(locale, 1, 12),
  ])

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
