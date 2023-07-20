import { Appstream, AppstreamListItem } from "./types/Appstream"
import { Collection, Collections } from "./types/Collection"
import { Category } from "./types/Category"
import { LoginProvider } from "./types/Login"

import {
  POPULAR_LAST_MONTH_URL,
  APP_DETAILS,
  RECENTLY_UPDATED_URL,
  RECENTLY_ADDED_URL,
  CATEGORY_URL,
  SEARCH_APP,
  SUMMARY_DETAILS,
  STATS_DETAILS,
  STATS,
  DEVELOPER_URL,
  PROJECTGROUP_URL,
  LOGIN_PROVIDERS_URL,
  VENDING_CONFIG_URL,
  EOL_REBASE_URL,
  EOL_MESSAGE_URL,
  APP_VERIFICATION_STATUS,
  APP_VERIFICATION_AVAILABLE_METHODS,
  REQUEST_ORG_ACCESS_LINK_GITHUB,
  VERIFIED_APPS_URL,
  CATEGORIES_URL,
  DEVELOPERS_URL,
  PROJECTGROUPS_URL,
  SUBCATEGORY_URL,
  APPSTREAM_URL,
  RUNTIMES,
} from "./env"
import { Summary } from "./types/Summary"
import { AppStats } from "./types/AppStats"
import { Stats } from "./types/Stats"
import { VendingConfig } from "./types/Vending"
import { VerificationStatus } from "./types/VerificationStatus"
import { VerificationAvailableMethods } from "./types/VerificationAvailableMethods"
import {
  AppsIndex,
  MeilisearchResponse,
  MeilisearchResponseLimited,
} from "./meilisearch"

export async function fetchAppstreamList(): Promise<string[]> {
  let entryJson: string[]
  try {
    const entryData = await fetch(APPSTREAM_URL)

    entryJson = await entryData.json()
  } catch (error) {
    console.log(error)
  }

  if (!entryJson) {
    console.log(`Couldn't get appstream list`)
  }
  return entryJson
}

export async function fetchAppstream(appId: string): Promise<Appstream> {
  let entryJson: Appstream
  try {
    const entryData = await fetch(`${APP_DETAILS(appId)}`)
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

export async function fetchEolMessage(
  appId: string,
): Promise<string | undefined> {
  let entryJson: string | undefined
  try {
    const entryData = await fetch(`${EOL_MESSAGE_URL(appId)}`)
    if (entryData.status === 200) {
      entryJson = await entryData.json()
    }
  } catch (error) {
    console.log(error)
  }

  if (!entryJson) {
    console.log(`No eol message data`)
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
    console.log(`No stats data for ${appId}`)
    statsJson = {
      installs_per_day: {},
      installs_last_7_days: 0,
      installs_last_month: 0,
      installs_total: 0,
    }
  }
  return statsJson
}

export default async function fetchCollection(
  collection: Collection,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  let collectionURL: string = ""
  switch (collection) {
    case Collections.popular:
      collectionURL = POPULAR_LAST_MONTH_URL(page, per_page)
      break
    case Collections.recentlyUpdated:
      collectionURL = RECENTLY_UPDATED_URL(page, per_page)
      break
    case Collections.recentlyAdded:
      collectionURL = RECENTLY_ADDED_URL(page, per_page)
      break
    case Collections.verified:
      collectionURL = VERIFIED_APPS_URL(page, per_page)
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

export async function fetchCategories(): Promise<Category[]> {
  const categories = await fetch(CATEGORIES_URL)
  const categoriesList = await categories.json()

  console.log(`Categories fetched. Returned items: ${categoriesList.length}.`)

  return categoriesList
}

export async function fetchCategory(
  category: keyof typeof Category,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  const appListRes = await fetch(CATEGORY_URL(category, page, per_page))
  const response: MeilisearchResponse<AppsIndex> = await appListRes.json()

  console.log(
    `Category ${category} fetched. Asked for Page: ${page} with ${per_page} per page. Returned items: ${response.totalHits}.`,
  )

  return response
}

export async function fetchSubcategory(
  category: keyof typeof Category,
  subcategory: string,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  const appListRes = await fetch(
    SUBCATEGORY_URL(category, subcategory, page, per_page),
  )
  const response: MeilisearchResponse<AppsIndex> = await appListRes.json()

  console.log(
    `Subcategory ${subcategory} fetched. Asked for Page: ${page} with ${per_page} per page. Returned items: ${response.totalHits}.`,
  )

  return response
}

export async function fetchDevelopers(): Promise<string[]> {
  const developers = await fetch(DEVELOPERS_URL)
  const developersList = await developers.json()

  console.log(`Developers fetched. Returned items: ${developersList.length}.`)

  return developersList
}

export async function fetchDeveloperApps(
  developer: string | undefined,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  if (!developer) {
    console.log("No developer specified")
    return null
  }
  console.log(`Fetching apps for developer ${developer}`)
  const appListRes = await fetch(DEVELOPER_URL(developer, page, per_page))
  if (!appListRes || appListRes.status === 404) {
    console.log(`No apps for developer ${developer}`)
    return null
  }

  const appList = await appListRes.json()

  console.log(`Developer apps for ${developer} fetched`)

  return appList
}

export async function fetchProjectgroups(): Promise<string[]> {
  const projectgroups = await fetch(PROJECTGROUPS_URL)
  const projectgroupsList = await projectgroups.json()

  console.log(
    `Project-groups fetched. Returned items: ${projectgroupsList.length}.`,
  )

  return projectgroupsList
}

export async function fetchProjectgroupApps(
  projectgroup: string | undefined,
  page?: number,
  per_page?: number,
): Promise<MeilisearchResponse<AppsIndex>> {
  if (!projectgroup) {
    console.log("No project-group specified")
    return null
  }
  console.log(`Fetching apps for project-group ${projectgroup}`)
  const appListRes = await fetch(PROJECTGROUP_URL(projectgroup, page, per_page))
  if (!appListRes || appListRes.status === 404) {
    console.log("No apps for project-group ", projectgroup)
    return null
  }

  const appList = await appListRes.json()

  console.log(`Project-group apps for ${projectgroup} fetched.`)

  return appList
}

export async function fetchSearchQuery(
  query: string,
  selectedFilters: {
    filterType: string
    value: string
  }[],
) {
  const queryEncoded = encodeURIComponent(query).replace(/\./g, "%2E")
  const appListRes = await fetch(SEARCH_APP, {
    method: "POST",
    body: JSON.stringify({
      query: queryEncoded,
      filters: selectedFilters,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  })
  const appList: MeilisearchResponseLimited<AppsIndex> = await appListRes.json()

  console.log(`Search for query: ${queryEncoded} fetched`)

  return appList
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

export async function fetchGithubRequestOrgAccessLink(): Promise<string> {
  let providersRes: Response
  try {
    providersRes = await fetch(REQUEST_ORG_ACCESS_LINK_GITHUB)

    if (!providersRes.ok) {
      console.log(
        `No request organization access link fetched, status ${providersRes.status}`,
      )
      return null
    }
  } catch (error) {
    console.log(error)
    return null
  }

  return (await providersRes.json()).link
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

export async function fetchVerificationAvailableMethods(
  appId: string,
  isNewApp: boolean,
): Promise<VerificationAvailableMethods | undefined> {
  let verificationMethods: VerificationAvailableMethods
  try {
    const verificationResponse = await fetch(
      `${APP_VERIFICATION_AVAILABLE_METHODS(appId, isNewApp ?? false)}`,
      { credentials: "include" },
    )
    verificationMethods = await verificationResponse.json()
  } catch (error) {
    console.log(`No available verification methods for ${appId}`)
  }
  return verificationMethods
}

export async function fetchRuntimes(): Promise<{ [key: string]: number }> {
  let runtimes: { [key: string]: number } = {}
  try {
    const verificationResponse = await fetch(RUNTIMES)
    runtimes = await verificationResponse.json()
  } catch (error) {
    console.log(`Could not fetch runtimes`)
  }
  return runtimes
}
