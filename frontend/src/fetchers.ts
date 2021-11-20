import { Appstream } from './types/Appstream'
import { Collection, Collections } from './types/Collection'
import { Category } from './types/Category'

import {
  POPULAR_URL,
  APP_DETAILS,
  RECENTLY_UPDATED_URL,
  EDITORS_PICKS_APPS_URL,
  EDITORS_PICKS_GAMES_URL,
  APPSTREAM_URL,
  CATEGORY_URL,
  SEARCH_APP,
  SUMMARY_DETAILS,
  STATS_DETAILS,
} from './env'
import { Summary } from './types/Summary'
import { AppStats } from './types/AppStats'

export async function fetchEntry(appId: string): Promise<Appstream | {}> {
  let entryJson: Appstream | {}
  try {
    const entryData = await fetch(`${APP_DETAILS(appId)}`)
    entryJson = await entryData.json()
  } catch (error) {
    console.log(error)
    entryJson = {}
  }

  if (!entryJson) {
    console.log('No appstream data for ', appId)
  }
  return entryJson
}

export async function fetchSummary(appId: string): Promise<Summary | {}> {
  let summaryJson: Summary | {}
  try {
    const summaryData = await fetch(`${SUMMARY_DETAILS(appId)}`)
    summaryJson = await summaryData.json()
  } catch (error) {
    console.log(error)
    summaryJson = {}
  }

  if (!summaryJson) {
    console.log('No summary data for ', appId)
  }
  return summaryJson
}

export async function fetchStats(appId: string): Promise<AppStats> {
  let statsJson: AppStats
  try {
    const statsData = await fetch(`${STATS_DETAILS(appId)}`)
    statsJson = await statsData.json()
  } catch (error) {
    console.log(error)
  }

  if (!statsJson) {
    console.log('No stats data for ', appId)
    statsJson = {
      downloads_last_7_days: 0,
      downloads_last_month: 0,
      downloads_total: 0,
    }
  }
  return statsJson
}

export default async function fetchCollection(
  collection: Collection,
  count?: number
): Promise<Appstream[]> {
  let collectionURL: string = ''
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
      collectionURL = ''
  }
  if (collectionURL === '') {
    console.log('Wrong collection parameter. Check your function call!')
    return
  }

  const collectionListRes = await fetch(collectionURL)
  const collectionList = await collectionListRes.json()

  const limit = count ? count : collectionList.length

  const limitedList = collectionList.slice(0, limit)

  const items: Appstream[] = await Promise.all(limitedList.map(fetchEntry))

  console.log('\nCollection ', collection, ' fetched')

  return items.filter((item) => Boolean(item))
}

export async function fetchApps() {
  const appListRes = await fetch(APPSTREAM_URL)
  const appList = await appListRes.json()

  const items: Appstream[] = await Promise.all(appList.map(fetchEntry))

  console.log('\nApps fetched')

  return items.filter((item) => Boolean(item))
}

export async function fetchCategory(category: keyof typeof Category) {
  const appListRes = await fetch(CATEGORY_URL(category))
  const appList = await appListRes.json()

  const items: Appstream[] = await Promise.all(appList.map(fetchEntry))

  console.log('\nCategory', category, ' fetched')

  return items.filter((item) => Boolean(item))
}

export async function fetchSearchQuery(query: string) {
  const appListRes = await fetch(SEARCH_APP(query))
  const appList = await appListRes.json()

  console.log("\nSearch for query: '", query, "' fetched")

  return appList.filter((item) => Boolean(item))
}
