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
import { Summary } from "./types/Summary"
import { VerificationStatus } from "./types/VerificationStatus"
import {
  AppOfTheDay,
  AppsOfTheWeek,
  getDeveloperCollectionDeveloperDeveloperGet,
  LoginMethod,
  MainCategory,
  MeilisearchResponseAppsIndex,
  SortBy,
  StatsResultApp,
  VendingConfig,
} from "./codegen"
import { gameCategoryFilter } from "./types/Category"

/**
 * Helper function to fetch and parse JSON with proper error handling
 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  try {
    return await response.json()
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}`)
  }
}

export async function fetchLoginProviders() {
  return await fetchJson<LoginMethod[]>(LOGIN_PROVIDERS_URL)
}

export async function fetchAppstream(
  appId: string,
  locale: string,
): Promise<Appstream | { error: string }> {
  try {
    const entryJson = await fetchJson<Appstream>(
      `${APP_DETAILS(appId, locale)}`,
    )
    return entryJson
  } catch (error) {
    return { error: `No appstream data for ${appId}` }
  }
}

export async function fetchEolRebase(
  appId: string,
): Promise<string | { error: string }> {
  try {
    const entryData = await fetch(`${EOL_REBASE_URL(appId)}`)
    if (!entryData.ok) {
      return { error: `No eol rebase data for ${appId}` }
    }
    return await entryData.json()
  } catch (error) {
    return { error: `No eol rebase data for ${appId}` }
  }
}

export async function fetchSummary(
  appId: string,
): Promise<Summary | { error: string }> {
  try {
    const summaryJson = await fetchJson<Summary>(`${SUMMARY_DETAILS(appId)}`)
    return summaryJson
  } catch (error) {
    return { error: `No summary data for ${appId}` }
  }
}

export async function fetchAppStats(appId: string): Promise<StatsResultApp> {
  try {
    return await fetchJson<StatsResultApp>(`${STATS_DETAILS(appId)}`)
  } catch (error) {
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

  try {
    const collectionList =
      await fetchJson<MeilisearchResponseAppsIndex>(collectionURL)

    console.log(
      `Collection ${collection} fetched. Asked for: ${page}. Returned items: ${collectionList.hits.length}.`,
    )

    return collectionList
  } catch (error) {
    return { error: `Failed to fetch collection ${collection}` }
  }
}

export async function fetchCategory(
  category: keyof typeof MainCategory,
  locale: string,
  page?: number,
  per_page?: number,
  exclude_subcategories?: string[],
  sort_by?: keyof typeof SortBy,
): Promise<MeilisearchResponseAppsIndex | { error: string }> {
  try {
    const response = await fetchJson<MeilisearchResponseAppsIndex>(
      CATEGORY_URL(
        category,
        page,
        per_page,
        locale,
        exclude_subcategories,
        sort_by,
      ),
    )

    console.log(
      `Category ${category} fetched. Asked for Page: ${page} with ${per_page} per page. Returned items: ${response.totalHits}.`,
    )

    return response
  } catch (error) {
    return { error: `Failed to fetch category ${category}` }
  }
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
  try {
    const response = await fetchJson<MeilisearchResponseAppsIndex>(
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

    console.log(
      `Subcategory ${subcategory} fetched. Asked for Page: ${page} with ${per_page} per page. Returned items: ${response.totalHits}.`,
    )

    return response
  } catch (error) {
    return { error: `Failed to fetch subcategory ${subcategory}` }
  }
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
  try {
    const data = await fetchJson<VendingConfig>(VENDING_CONFIG_URL)
    return data
  } catch (error) {
    return { error: "Failed to fetch vending config" }
  }
}

export async function fetchVerificationStatus(
  appId: string,
): Promise<VerificationStatus | { error: string }> {
  try {
    const verification = await fetchJson<VerificationStatus>(
      `${APP_VERIFICATION_STATUS(appId)}`,
    )
    return verification
  } catch (error) {
    return { error: `No verification data for ${appId}` }
  }
}

export async function fetchAddons(appid: string, locale: string) {
  try {
    const addonList: string[] = await fetchJson<string[]>(ADDONS_URL(appid))

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
  } catch (error) {
    console.error(`Failed to fetch addons for ${appid}:`, error)
    return []
  }
}

export async function fetchAppsOfTheWeek(
  date: string,
): Promise<AppsOfTheWeek | { error: string }> {
  try {
    const json = await fetchJson<AppsOfTheWeek>(APPS_OF_THE_WEEK_URL(date))
    return json
  } catch (error) {
    return { error: `No app of the week data for ${date}` }
  }
}

export async function fetchAppOfTheDay(
  date: string,
): Promise<AppOfTheDay | { error: string }> {
  try {
    const json = await fetchJson<AppOfTheDay>(APP_OF_THE_DAY_URL(date))
    return json
  } catch (error) {
    return { error: `No app of the day data for ${date}` }
  }
}
