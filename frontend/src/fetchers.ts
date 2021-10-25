import Appstream from './types/Appstream'
import Collections, {Collection} from './types/Collection'
import Category from './types/Category'

import {POPULAR_URL, APP_DETAILS, RECENTLY_UPDATED_URL, EDITORS_PICKS_APPS_URL, EDITORS_PICKS_GAMES_URL, APPSTREAM_URL, CATEGORY_URL, SEARCH_APP} from './env'

export async function fetchEntry(entry: string): Promise<Appstream | {}> {
  let entryJson: Appstream | {}
  try {
    const entryData = await fetch(`${APP_DETAILS(entry)}`)
    entryJson = await entryData.json()
  } catch(error) {
    console.log(error)
    entryJson = {}
  }

  if(!entryJson) {console.log("No data for ", entry)}
  return entryJson;
}

export default async function fetchCollection (collection: Collection, count?: number): Promise<Appstream[]> {
  let collectionURL: string = ''
  switch(collection) {
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
    default: collectionURL = ''
  }
  if (collectionURL === '') {
    console.log("Wrong collection parameter. Check your function call!")
    return
  }

  const collectionListRes = await fetch(collectionURL)
  const collectionList = await collectionListRes.json()

  const limit = count ? count : collectionList.length

  const limitedList = collectionList.slice(0, limit)

  const items: Appstream[] = await Promise.all(limitedList.map(fetchEntry))

  console.log("\nCollection ", collection, " fetched")

  return items.filter(item => Boolean(item))
}

export async function fetchApps() {
  const appListRes = await fetch(APPSTREAM_URL)
  const appList = await appListRes.json()

  const items: Appstream[] = await Promise.all(appList.map(fetchEntry))

  console.log("\nApps fetched")

  return items.filter(item => Boolean(item))
}

export async function fetchCategory(category: keyof typeof Category) {
  const appListRes = await fetch(CATEGORY_URL(category))
  const appList = await appListRes.json()

  const items: Appstream[] = await Promise.all(appList.map(fetchEntry))

  console.log("\nCategory", category, " fetched")

  return items.filter(item => Boolean(item))
}

export async function fetchSearchQuery(query:string) {
  const appListRes = await fetch(SEARCH_APP(query))
  const appList = await appListRes.json()

  console.log("\nSearch for query: '", query, "' fetched")

  return appList.filter(item => Boolean(item))
}
