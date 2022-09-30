import { Appstream, AppstreamListItem } from "./types/Appstream"
import { Collection, Collections } from "./types/Collection"
import { Category } from "./types/Category"
import { LoginProvider } from "./types/Login"

import {
  POPULAR_URL,
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
  APP_VERIFICATION_STATUS,
  APP_VERIFICATION_AVAILABLE_METHODS,
} from "./env"
import { Summary } from "./types/Summary"
import { AppStats } from "./types/AppStats"
import { Stats } from "./types/Stats"
import { VendingConfig } from "./types/Vending"
import { VerificationStatus } from "./types/VerificationStatus"
import { VerificationAvailableMethods } from "./types/VerificationAvailableMethods"

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
    entryJson = await entryData.json()
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
  count?: number,
): Promise<AppstreamListItem[]> {
  let collectionURL: string = ""
  switch (collection) {
    case Collections.popular:
      collectionURL = POPULAR_URL
      break
    case Collections.recentlyUpdated:
      collectionURL = RECENTLY_UPDATED_URL
      break
    case Collections.recentlyAdded:
      collectionURL = RECENTLY_ADDED_URL
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

  const limitedList = collectionList.slice(0, limit)

  console.log(
    `\nCollection ${collection} fetched. Asked for: ${count}. Returned items: ${limitedList.filter((item) => Boolean(item)).length
    }.`,
  )

  return limitedList.filter((item) => Boolean(item))
}

export async function fetchCategory(
  category: keyof typeof Category,
  page?: number,
  per_page?: number,
): Promise<AppstreamListItem[]> {
  const appListRes = await fetch(CATEGORY_URL(category, page, per_page))
  const appList = await appListRes.json()

  console.log(
    `\nCategory ${category} fetched. Asked for Page: ${page} with ${per_page} per page. Returned items: ${appList.filter((item) => Boolean(item)).length
    }.`,
  )

  return appList.filter((item) => Boolean(item))
}

export async function fetchDeveloperApps(developer: string | undefined) {
  if (!developer) {
    console.log("No developer specified")
    return null
  }
  console.log(`\nFetching apps for developer ${developer}`)
  const appListRes = await fetch(DEVELOPER_URL(developer))
  if (!appListRes || appListRes.status === 404) {
    console.log(`No apps for developer ${developer}`)
    return null
  }

  const appList = await appListRes.json()

  console.log(`Developer apps for ${developer} fetched`)

  return appList.filter((item) => Boolean(item))
}

export async function fetchProjectgroupApps(projectgroup: string | undefined) {
  if (!projectgroup) {
    console.log("No project-group specified")
    return null
  }
  console.log(`\nFetching apps for project-group ${projectgroup}`)
  const appListRes = await fetch(PROJECTGROUP_URL(projectgroup))
  if (!appListRes || appListRes.status === 404) {
    console.log("No apps for project-group ", projectgroup)
    return null
  }

  const appList = await appListRes.json()

  console.log(`Project-group apps for ${projectgroup} fetched.`)

  return appList.filter((item) => Boolean(item))
}

export async function fetchSearchQuery(query: string) {
  const queryEncoded = encodeURIComponent(query).replace(/\./g, "%2E")
  const appListRes = await fetch(SEARCH_APP(queryEncoded))
  const appList = await appListRes.json()

  console.log(`\nSearch for query: ${queryEncoded} fetched`)

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
): Promise<VerificationAvailableMethods | undefined> {
  let verificationMethods: VerificationAvailableMethods
  try {
    const verificationResponse = await fetch(
      `${APP_VERIFICATION_AVAILABLE_METHODS(appId)}`,
    )
    verificationMethods = await verificationResponse.json()
  } catch (error) {
    console.log(`No available verification methods for ${appId}`)
  }
  return verificationMethods
}
