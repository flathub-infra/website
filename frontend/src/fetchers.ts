import { Appstream } from "./types/Appstream"

import {
  POPULAR_LAST_MONTH_URL,
  APP_DETAILS,
  RECENTLY_UPDATED_URL,
  RECENTLY_ADDED_URL,
  CATEGORY_URL,
  SEARCH_APP,
  SUMMARY_DETAILS,
  STATS_DETAILS,
  DEVELOPER_URL,
  VENDING_CONFIG_URL,
  EOL_REBASE_URL,
  APP_VERIFICATION_STATUS,
  VERIFIED_APPS_URL,
  SUBCATEGORY_URL,
  TRENDING_LAST_TWO_WEEKS_URL,
  ADDONS_URL,
  APP_OF_THE_DAY_URL,
  APPS_OF_THE_WEEK_URL,
  MOBILE_APPS_URL,
} from "./env"
import { Summary } from "./types/Summary"
import { AppStats } from "./types/AppStats"
import { VerificationStatus } from "./types/VerificationStatus"
import {
  AppsIndex,
  MeilisearchResponse,
  MeilisearchResponseLimited,
} from "./meilisearch"
import {
  AppOfTheDay,
  AppsOfTheWeek,
  MainCategory,
  SortBy,
  VendingConfig,
} from "./codegen"
import axios from "axios"
import { gameCategoryFilter } from "./types/Category"

export async function fetchAppstream(
  appId: string,
  locale: string,
): Promise<Appstream> {
  let entryJson: Appstream | undefined = undefined
  try {
    const entryData = await fetch(`${APP_DETAILS(appId, locale)}`)
    entryJson = await entryData.json()
  } catch (error) {
    console.log(error)
  }

  if (!entryJson) {
    console.log(`No appstream data for ${appId}`)
  }
  return entryJson
}

export async function fetchEolRebase(
  appId: string,
): Promise<string | undefined> {
  let entryJson: string | undefined
  try {
    const entryData = await fetch(`${EOL_REBASE_URL(appId)}`)
    if (entryData.status === 200) {
      entryJson = await entryData.json()
    }
  } catch (error) {
    console.log(error)
  }

  if (!entryJson) {
    console.log(`No eol rebase data`)
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
    console.log(`No summary data for ${appId}`)
  }
  return summaryJson
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
    console.log(`No stats data for ${appId}`)
    statsJson = {
      id: appId,
      installs_per_day: {},
      installs_last_7_days: 0,
      installs_last_month: 0,
      installs_total: 0,
    }
  }
  return statsJson
}

export default async function fetchCollection(
  collection:
    | "popular"
    | "recently-updated"
    | "recently-added"
    | "verified"
    | "trending"
    | "mobile",
  page?: number,
  per_page?: number,
  locale?: string,
): Promise<MeilisearchResponse<AppsIndex>> {
  let collectionURL: string = ""
  switch (collection) {
    case "popular":
      collectionURL = POPULAR_LAST_MONTH_URL(page, per_page, locale)
      break
    case "recently-updated":
      collectionURL = RECENTLY_UPDATED_URL(page, per_page, locale)
      break
    case "recently-added":
      collectionURL = RECENTLY_ADDED_URL(page, per_page, locale)
      break
    case "verified":
      collectionURL = VERIFIED_APPS_URL(page, per_page, locale)
      break
    case "trending":
      collectionURL = TRENDING_LAST_TWO_WEEKS_URL(page, per_page, locale)
      break
    case "mobile":
      collectionURL = MOBILE_APPS_URL(page, per_page, locale)
      break
    default:
      collectionURL = ""
  }
  if (collectionURL === "") {
    console.log("Wrong collection parameter. Check your function call!")
    return
  }

  const collectionListRes = await fetch(collectionURL)
  const collectionList: MeilisearchResponse<AppsIndex> =
    await collectionListRes.json()

  console.log(
    `Collection ${collection} fetched. Asked for: ${page}. Returned items: ${collectionList.hits.length}.`,
  )

  return collectionList
}

export async function fetchCategory(
  category: keyof typeof MainCategory,
  locale: string,
  page?: number,
  per_page?: number,
  exclude_subcategories?: string[],
  sort_by?: keyof typeof SortBy,
): Promise<MeilisearchResponse<AppsIndex>> {
  const appListRes = await fetch(
    CATEGORY_URL(
      category,
      page,
      per_page,
      locale,
      exclude_subcategories,
      sort_by,
    ),
  )
  const response: MeilisearchResponse<AppsIndex> = await appListRes.json()

  console.log(
    `Category ${category} fetched. Asked for Page: ${page} with ${per_page} per page. Returned items: ${response.totalHits}.`,
  )

  return response
}

export async function fetchGameCategory(
  locale: string,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  return await fetchCategory(
    MainCategory.game,
    locale,
    page,
    per_page,
    gameCategoryFilter,
    SortBy.trending,
  )
}

export async function fetchGameEmulatorCategory(
  locale: string,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  return await fetchSubcategory(
    MainCategory.game,
    ["emulator"],
    locale,
    page,
    per_page,
    [],
    SortBy.trending,
  )
}

export async function fetchGamePackageManagerCategory(
  locale: string,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  return await fetchSubcategory(
    MainCategory.game,
    ["packageManager"],
    locale,
    page,
    per_page,
    [],
    SortBy.trending,
  )
}

export async function fetchGameUtilityCategory(
  locale: string,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  return await fetchSubcategory(
    MainCategory.game,
    ["utility", "network"],
    locale,
    page,
    per_page,
    [],
    SortBy.trending,
  )
}

export async function fetchSubcategory(
  category: keyof typeof MainCategory,
  subcategory: string[],
  locale: string,
  page?: number,
  per_page?: number,
  exclude_subcategories?: string[],
  sort_by?: keyof typeof SortBy,
): Promise<MeilisearchResponse<AppsIndex>> {
  const appListRes = await fetch(
    SUBCATEGORY_URL(
      category,
      subcategory,
      page,
      per_page,
      locale,
      exclude_subcategories,
      sort_by,
    ),
  )
  const response: MeilisearchResponse<AppsIndex> = await appListRes.json()

  console.log(
    `Subcategory ${subcategory} fetched. Asked for Page: ${page} with ${per_page} per page. Returned items: ${response.totalHits}.`,
  )

  return response
}

export async function fetchDeveloperApps(
  developer: string | undefined,
  locale: string,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  if (!developer) {
    console.log("No developer specified")
    return null
  }
  console.log(`Fetching apps for developer ${developer}`)
  const appListRes = await fetch(
    DEVELOPER_URL(developer, page, per_page, locale),
  )
  if (!appListRes || appListRes.status === 404) {
    console.log(`No apps for developer ${developer}`)
    return null
  }

  const appList = await appListRes.json()

  console.log(`Developer apps for ${developer} fetched`)

  return appList
}

export async function fetchSearchQuery(
  query: string,
  locale: string,
  selectedFilters: {
    filterType: string
    value: string
  }[],
) {
  return axios.post<MeilisearchResponseLimited<AppsIndex>>(
    SEARCH_APP(locale),
    {
      query: query,
      filters: selectedFilters,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  )
}

export async function fetchVendingConfig(): Promise<VendingConfig | null> {
  let res: Response
  try {
    res = await fetch(VENDING_CONFIG_URL)
  } catch {
    return null
  }

  if (res.ok) {
    const data: VendingConfig = await res.json()
    return data
  } else {
    return null
  }
}

export async function fetchVerificationStatus(
  appId: string,
): Promise<VerificationStatus | undefined> {
  let verification: VerificationStatus
  try {
    const verificationResponse = await fetch(
      `${APP_VERIFICATION_STATUS(appId)}`,
    )
    verification = await verificationResponse.json()
  } catch (error) {
    console.log(`No verification data for ${appId}`)
  }
  return verification
}

export async function fetchAddons(appid: string, locale: string) {
  const addonListResponse = await fetch(ADDONS_URL(appid))

  const addonList: string[] = await addonListResponse.json()

  const addonAppstreams = await Promise.all(
    addonList.map((addon) => fetchAppstream(addon, locale)),
  )

  const addonAppStats = await Promise.all(addonList.map(fetchAppStats))

  const combined = addonAppstreams.map((item) => {
    return {
      id: item.id,
      appstream: item,
      stats: addonAppStats.find((stats) => stats.id === item.id),
    }
  })

  console.log(`\nAddons for ${appid} fetched`)

  combined.sort((a, b) => {
    return b.stats.installs_total - a.stats.installs_total
  })

  return combined.map((item) => item.appstream)
}

export async function fetchAppsOfTheWeek(date: string) {
  let json: AppsOfTheWeek
  try {
    const data = await fetch(APPS_OF_THE_WEEK_URL(date))
    json = await data.json()
  } catch (error) {
    console.log(error)
  }

  if (!json) {
    console.log(`No app of the week data for ${date}`)
  }
  return json
}

export async function fetchAppOfTheDay(date: string) {
  let json: AppOfTheDay
  try {
    const data = await fetch(APP_OF_THE_DAY_URL(date))
    json = await data.json()
  } catch (error) {
    console.log(error)
  }

  if (!json) {
    console.log(`No app of the week data for ${date}`)
  }
  return json
}
