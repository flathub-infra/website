import { Appstream } from "./types/Appstream"

import {
  POPULAR_LAST_MONTH_URL,
  APP_DETAILS,
  RECENTLY_UPDATED_URL,
  RECENTLY_ADDED_URL,
  CATEGORY_URL,
  SUMMARY_DETAILS,
  STATS_DETAILS,
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
  LOGIN_PROVIDERS_URL,
} from "./env"
import { robustFetchJson, robustFetch } from "./utils/fetch"
import { Summary } from "./types/Summary"
import { VerificationStatus } from "./types/VerificationStatus"
import {
  AppOfTheDay,
  AppsOfTheWeek,
  getDeveloperCollectionDeveloperDeveloperGet,
  MainCategory,
  MeilisearchResponseAppsIndex,
  SortBy,
  StatsResultApp,
  VendingConfig,
} from "./codegen"
import { gameCategoryFilter } from "./types/Category"

export async function fetchLoginProviders() {
  return await robustFetchJson(LOGIN_PROVIDERS_URL)
}

export async function fetchAppstream(
  appId: string,
  locale: string,
): Promise<Appstream | { error: string }> {
  const entryJson = await robustFetchJson<Appstream>(
    `${APP_DETAILS(appId, locale)}`,
  )

  if (!entryJson) {
    return { error: `No appstream data for ${appId}` }
  }
  return entryJson
}

export async function fetchEolRebase(
  appId: string,
): Promise<string | { error: string }> {
  const entryData = await robustFetch(`${EOL_REBASE_URL(appId)}`)
  if (entryData.status === 200) {
    return await entryData.json()
  }

  return { error: `No eol rebase data for ${appId}` }
}

export async function fetchSummary(
  appId: string,
): Promise<Summary | { error: string }> {
  const summaryJson = await robustFetchJson<Summary>(
    `${SUMMARY_DETAILS(appId)}`,
  )

  if (!summaryJson) {
    return { error: `No summary data for ${appId}` }
  }
  return summaryJson
}

export async function fetchAppStats(appId: string): Promise<StatsResultApp> {
  const statsJson = await robustFetchJson<StatsResultApp>(
    `${STATS_DETAILS(appId)}`,
  )

  if (!statsJson) {
    // Return default stats instead of error for stats
    return {
      id: appId,
      installs_per_day: {},
      installs_last_7_days: 0,
      installs_last_month: 0,
      installs_total: 0,
      installs_per_country: {},
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
): Promise<MeilisearchResponseAppsIndex | { error: string }> {
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
    return { error: "Wrong collection parameter. Check your function call!" }
  }

  const collectionList =
    await robustFetchJson<MeilisearchResponseAppsIndex>(collectionURL)

  if (!collectionList) {
    return { error: `Failed to fetch collection ${collection}` }
  }

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
): Promise<MeilisearchResponseAppsIndex | { error: string }> {
  const response = await robustFetchJson<MeilisearchResponseAppsIndex>(
    CATEGORY_URL(
      category,
      page,
      per_page,
      locale,
      exclude_subcategories,
      sort_by,
    ),
  )

  if (!response) {
    return { error: `Failed to fetch category ${category}` }
  }

  console.log(
    `Category ${category} fetched. Asked for Page: ${page} with ${per_page} per page. Returned items: ${response.totalHits}.`,
  )

  return response
}

export async function fetchGameCategory(
  locale: string,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponseAppsIndex | { error: string }> {
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
): Promise<MeilisearchResponseAppsIndex | { error: string }> {
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
): Promise<MeilisearchResponseAppsIndex | { error: string }> {
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
): Promise<MeilisearchResponseAppsIndex | { error: string }> {
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
): Promise<MeilisearchResponseAppsIndex | { error: string }> {
  const response = await robustFetchJson<MeilisearchResponseAppsIndex>(
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

  if (!response) {
    return { error: `Failed to fetch subcategory ${subcategory}` }
  }

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
): Promise<MeilisearchResponseAppsIndex | { error: string }> {
  if (!developer) {
    return { error: "No developer specified" }
  }
  console.log(`Fetching apps for developer ${developer}`)

  const appList = await getDeveloperCollectionDeveloperDeveloperGet(developer, {
    page,
    per_page,
    locale,
  })

  if (!appList || appList.status === 404) {
    return { error: `No apps for developer ${developer}` }
  }

  console.log(`Developer apps for ${developer} fetched`)

  return appList.data as MeilisearchResponseAppsIndex
}

export async function fetchVendingConfig(): Promise<
  VendingConfig | { error: string }
> {
  const data = await robustFetchJson<VendingConfig>(VENDING_CONFIG_URL)
  if (!data) {
    return { error: "Failed to fetch vending config" }
  }
  return data
}

export async function fetchVerificationStatus(
  appId: string,
): Promise<VerificationStatus | { error: string }> {
  const verification = await robustFetchJson<VerificationStatus>(
    `${APP_VERIFICATION_STATUS(appId)}`,
  )
  if (!verification) {
    return { error: `No verification data for ${appId}` }
  }
  return verification
}

export async function fetchAddons(appid: string, locale: string) {
  const addonList: string[] = await robustFetchJson<string[]>(ADDONS_URL(appid))

  const addonAppstreams = await Promise.all(
    addonList.map((addon) => fetchAppstream(addon, locale)),
  )

  const addonAppStats = await Promise.all(addonList.map(fetchAppStats))

  const combined = addonAppstreams
    .filter((a): a is Appstream => a && "id" in a)
    .map((item) => {
      return {
        id: item.id,
        appstream: item,
        stats: addonAppStats.find((stats) => stats.id === item.id),
      }
    })

  console.log(`\nAddons for ${appid} fetched`)

  combined.sort((a, b) => {
    return b.stats.installs_last_month - a.stats.installs_last_month
  })

  return combined.map((item) => item.appstream)
}

export async function fetchAppsOfTheWeek(
  date: string,
): Promise<AppsOfTheWeek | { error: string }> {
  const json = await robustFetchJson<AppsOfTheWeek>(APPS_OF_THE_WEEK_URL(date))

  if (!json) {
    return { error: `No app of the week data for ${date}` }
  }
  return json
}

export async function fetchAppOfTheDay(
  date: string,
): Promise<AppOfTheDay | { error: string }> {
  const json = await robustFetchJson<AppOfTheDay>(APP_OF_THE_DAY_URL(date))

  if (!json) {
    return { error: `No app of the day data for ${date}` }
  }
  return json
}
