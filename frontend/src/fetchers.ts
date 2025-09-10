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
  MainCategory,
  MeilisearchResponseAppsIndex,
  SortBy,
  StatsResultApp,
  VendingConfig,
} from "./codegen"
import { gameCategoryFilter } from "./types/Category"

export async function fetchLoginProviders() {
  const res = await fetch(LOGIN_PROVIDERS_URL, {
    next: { revalidate: 3600 }, // Cache for 1 hour
  })
  return await res.json()
}

export async function fetchAppstream(
  appId: string,
  locale: string,
): Promise<Appstream> {
  let entryJson: Appstream | undefined = undefined
  try {
    const entryData = await fetch(`${APP_DETAILS(appId, locale)}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })
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
    const entryData = await fetch(`${EOL_REBASE_URL(appId)}`, {
      next: { revalidate: 86400 }, // Cache for 24 hours (EOL data changes infrequently)
    })
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
    const summaryData = await fetch(`${SUMMARY_DETAILS(appId)}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })
    summaryJson = await summaryData.json()
  } catch (error) {
    console.log(error)
  }

  if (!summaryJson) {
    console.log(`No summary data for ${appId}`)
  }
  return summaryJson
}

export async function fetchAppStats(appId: string): Promise<StatsResultApp> {
  let statsJson: StatsResultApp
  try {
    const statsData = await fetch(`${STATS_DETAILS(appId)}`, {
      next: { revalidate: 1800 }, // Cache for 30 minutes (stats change more frequently)
    })
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
): Promise<MeilisearchResponseAppsIndex> {
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

  const collectionListRes = await fetch(collectionURL, {
    next: { revalidate: 1800 }, // Cache for 30 minutes (collections change frequently)
  })
  const collectionList: MeilisearchResponseAppsIndex =
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
): Promise<MeilisearchResponseAppsIndex> {
  const appListRes = await fetch(
    CATEGORY_URL(
      category,
      page,
      per_page,
      locale,
      exclude_subcategories,
      sort_by,
    ),
    {
      next: { revalidate: 3600 }, // Cache for 1 hour
    },
  )
  const response: MeilisearchResponseAppsIndex = await appListRes.json()

  console.log(
    `Category ${category} fetched. Asked for Page: ${page} with ${per_page} per page. Returned items: ${response.totalHits}.`,
  )

  return response
}

export async function fetchGameCategory(
  locale: string,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponseAppsIndex> {
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
): Promise<MeilisearchResponseAppsIndex> {
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
): Promise<MeilisearchResponseAppsIndex> {
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
): Promise<MeilisearchResponseAppsIndex> {
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
): Promise<MeilisearchResponseAppsIndex> {
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
    {
      next: { revalidate: 3600 }, // Cache for 1 hour
    },
  )
  const response: MeilisearchResponseAppsIndex = await appListRes.json()

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
): Promise<MeilisearchResponseAppsIndex> {
  if (!developer) {
    console.log("No developer specified")
    return null
  }
  console.log(`Fetching apps for developer ${developer}`)

  const appList = await getDeveloperCollectionDeveloperDeveloperGet(developer, {
    page,
    per_page,
    locale,
  })

  if (!appList || appList.status === 404) {
    console.log(`No apps for developer ${developer}`)
    return null
  }

  console.log(`Developer apps for ${developer} fetched`)

  return appList.data as MeilisearchResponseAppsIndex
}

export async function fetchVendingConfig(): Promise<VendingConfig | null> {
  let res: Response
  try {
    res = await fetch(VENDING_CONFIG_URL, {
      next: { revalidate: 86400 }, // Cache for 24 hours (config changes infrequently)
    })
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
      {
        next: { revalidate: 86400 }, // Cache for 24 hours (verification status changes infrequently)
      },
    )
    verification = await verificationResponse.json()
  } catch (error) {
    console.log(`No verification data for ${appId}`)
  }
  return verification
}

export async function fetchAddons(appid: string, locale: string) {
  const addonListResponse = await fetch(ADDONS_URL(appid), {
    next: { revalidate: 3600 }, // Cache for 1 hour
  })

  const addonList: string[] = await addonListResponse.json()

  const addonAppstreams = await Promise.all(
    addonList.map((addon) => fetchAppstream(addon, locale)),
  )

  const addonAppStats = await Promise.all(addonList.map(fetchAppStats))

  const combined = addonAppstreams
    .filter((a) => a?.id)
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

export async function fetchAppsOfTheWeek(date: string) {
  let json: AppsOfTheWeek
  try {
    const data = await fetch(APPS_OF_THE_WEEK_URL(date), {
      next: { revalidate: 43200 }, // Cache for 12 hours (app of the week changes daily)
    })
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
    const data = await fetch(APP_OF_THE_DAY_URL(date), {
      next: { revalidate: 43200 }, // Cache for 12 hours (app of the day changes daily)
    })
    json = await data.json()
  } catch (error) {
    console.log(error)
  }

  if (!json) {
    console.log(`No app of the week data for ${date}`)
  }
  return json
}
