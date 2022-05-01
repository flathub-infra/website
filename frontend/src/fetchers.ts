import { AddonAppstream, DesktopAppstream } from "./types/Appstream"
import { Collection, Collections } from "./types/Collection"
import { Category } from "./types/Category"
import { LoginProvider } from "./types/Login"

import {
  POPULAR_URL,
  APP_DETAILS,
  RECENTLY_UPDATED_URL,
  EDITORS_PICKS_APPS_URL,
  EDITORS_PICKS_GAMES_URL,
  CATEGORY_URL,
  SEARCH_APP,
  SUMMARY_DETAILS,
  STATS_DETAILS,
  STATS,
  DEVELOPER_URL,
  LOGIN_PROVIDERS_URL,
  ADDONS_URL,
} from "./env"
import { Summary } from "./types/Summary"
import { AppStats } from "./types/AppStats"
import { Stats } from "./types/Stats"

export async function fetchAppstream(appId: string): Promise<DesktopAppstream> {
  let entryJson: DesktopAppstream
  try {
    const entryData = await fetch(`${APP_DETAILS(appId)}`)
    entryJson = await entryData.json()
  } catch (error) {
    console.log(error)
  }

  if (!entryJson) {
    console.log("No appstream data for ", appId)
  }
  return entryJson
}

export async function fetchSummary(appId: string): Promise<Summary> {
  let summaryJson: Summary
  try {
    const summaryData = await fetch(`${SUMMARY_DETAILS(appId)}`)
    summaryJson = await summaryData.json()
  } catch (error) {
    console.log(error)
  }

  if (!summaryJson) {
    console.log("No summary data for ", appId)
  }
  return summaryJson
}

export async function fetchStats(): Promise<Stats> {
  let statsJson: Stats
  try {
    const statsData = await fetch(`${STATS}`)
    statsJson = await statsData.json()
  } catch (error) {
    console.log(error)
  }

  if (!statsJson) {
    console.log("No stats data")
  }
  return statsJson
}

export async function fetchAppStats(appId: string): Promise<AppStats> {
  let statsJson: AppStats
  try {
    const statsData = await fetch(`${STATS_DETAILS(appId)}`)
    statsJson = await statsData.json()
  } catch (error) {
    console.log(error)
  }

  if (!statsJson) {
    console.log("No stats data for ", appId)
    statsJson = {
      downloads_per_day: {},
      downloads_last_7_days: 0,
      downloads_last_month: 0,
      downloads_total: 0,
    }
  }
  return statsJson
}

export default async function fetchCollection(
  collection: Collection,
  count?: number,
): Promise<DesktopAppstream[]> {
  let collectionURL: string = ""
  switch (collection) {
    case Collections.popular:
      collectionURL = POPULAR_URL
      break
    case Collections.recentlyUpdated:
      collectionURL = RECENTLY_UPDATED_URL
      break
    case Collections.editorsApps:
      collectionURL = EDITORS_PICKS_APPS_URL
      break
    case Collections.editorsGames:
      collectionURL = EDITORS_PICKS_GAMES_URL
      break
    default:
      collectionURL = ""
  }
  if (collectionURL === "") {
    console.log("Wrong collection parameter. Check your function call!")
    return
  }

  const collectionListRes = await fetch(collectionURL)
  const collectionList = await collectionListRes.json()

  const limit = count ? count : collectionList.length

  const limitedList = collectionList
    .sort((a, b) => {
      if (
        collection === Collections.editorsApps ||
        collection == Collections.editorsGames
      ) {
        return 0.5 - Math.random()
      }
      // don't change sorting for all others
      return
    })
    .slice(0, limit)

  const items: DesktopAppstream[] = await Promise.all(
    limitedList.map(fetchAppstream),
  )

  console.log("\nCollection ", collection, " fetched")

  return items.filter((item) => Boolean(item))
}

export async function fetchCategory(
  category: keyof typeof Category,
  page?: number,
  per_page?: number,
): Promise<DesktopAppstream[]> {
  const appListRes = await fetch(CATEGORY_URL(category, page, per_page))
  const appList = await appListRes.json()

  const items: DesktopAppstream[] = await Promise.all(
    appList.map(fetchAppstream),
  )

  console.log("\nCategory", category, " fetched")

  return items.filter((item) => Boolean(item))
}

export async function fetchAddons(appid: string) {
  const appListRes = await fetch(ADDONS_URL(appid))
  const appList = await appListRes.json()

  const items: AddonAppstream[] = await Promise.all(appList.map(fetchAppstream))

  console.log("\nAddons for ", appid, " fetched")

  return items.filter((item) => Boolean(item))
}

export async function fetchDeveloperApps(developer: string | undefined) {
  if (!developer) {
    console.log("No developer specified")
    return undefined
  }
  console.log("\nFetching apps for developer ", developer)
  const appListRes = await fetch(DEVELOPER_URL(developer))
  if (!appListRes || appListRes.status === 404) {
    console.log("No apps for developer ", developer)
    return undefined
  }

  const appList = await appListRes.json()

  const items: DesktopAppstream[] = await Promise.all(
    appList.map(fetchAppstream),
  )

  console.log(`Developer apps for ${developer} fetched`)

  return items.filter((item) => Boolean(item))
}

export async function fetchSearchQuery(query: string) {
  const appListRes = await fetch(SEARCH_APP(query))
  const appList = await appListRes.json()

  console.log("\nSearch for query: '", query, "' fetched")

  return appList.filter((item) => Boolean(item))
}

export async function fetchLoginProviders(): Promise<LoginProvider[]> {
  // Ensure problem is visible in logs if fetch fails at build
  let providersRes: Response
  try {
    providersRes = await fetch(LOGIN_PROVIDERS_URL)

    if (!providersRes.ok) {
      console.log(
        `No login providers data fetched, status ${providersRes.status}`,
      )
      return null
    }
  } catch (error) {
    console.log(error)
    return null
  }

  return await providersRes.json()
}
