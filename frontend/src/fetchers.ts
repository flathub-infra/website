import { Appstream } from "./types/Appstream"
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
import axios from "axios"

export async function fetchAppstreamList() {
  return axios.get<string[]>(APPSTREAM_URL)
}

export async function fetchAppstream(appId: string) {
  return axios.get<Appstream>(`${APP_DETAILS(appId)}`)
}

export async function fetchEolRebase(appId: string) {
  return axios
    .get<string | undefined>(`${EOL_REBASE_URL(appId)}`)
    .catch((error) => {
      if (error.response.status === 404) {
        return {
          data: undefined,
        }
      }
    })
}

export async function fetchEolMessage(appId: string) {
  return axios.get<string | undefined>(`${EOL_MESSAGE_URL(appId)}`)
}

export async function fetchSummary(appId: string) {
  return axios.get<Summary>(`${SUMMARY_DETAILS(appId)}`)
}

export async function fetchStats() {
  return axios.get<Stats>(`${STATS}`)
}

export async function fetchAppStats(appId: string) {
  return axios.get<AppStats>(`${STATS_DETAILS(appId)}`).catch((error) => {
    if (error.response.status === 404) {
      return {
        data: {
          installs_per_day: {},
          installs_last_7_days: 0,
          installs_last_month: 0,
          installs_total: 0,
        },
      }
    }
  })
}

export default async function fetchCollection(
  collection: Collection,
  page?: number,
  per_page?: number,
) {
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

  return axios.get<MeilisearchResponse<AppsIndex>>(collectionURL)
}

export async function fetchCategories() {
  return axios.get<Category[]>(CATEGORIES_URL)
}

export async function fetchCategory(
  category: keyof typeof Category,
  page?: number,
  per_page?: number,
) {
  return axios.get<MeilisearchResponse<AppsIndex>>(
    CATEGORY_URL(category, page, per_page),
  )
}

export async function fetchSubcategory(
  category: keyof typeof Category,
  subcategory: string,
  page?: number,
  per_page?: number,
) {
  return axios.get<MeilisearchResponse<AppsIndex>>(
    SUBCATEGORY_URL(category, subcategory, page, per_page),
  )
}

export async function fetchDevelopers() {
  return axios.get<string[]>(DEVELOPERS_URL)
}

export async function fetchDeveloperApps(
  developer: string | undefined,
  page?: number,
  per_page?: number,
) {
  if (!developer) {
    console.log("No developer specified")
    return { data: null }
  }
  console.log(`Fetching apps for developer ${developer}`)
  return axios
    .get<MeilisearchResponse<AppsIndex>>(
      DEVELOPER_URL(developer, page, per_page),
    )
    .catch((error) => {
      return {
        data: null,
      }
    })
}

export async function fetchProjectgroups() {
  return axios.get<string[]>(PROJECTGROUPS_URL)
}

export async function fetchProjectgroupApps(
  projectgroup: string | undefined,
  page?: number,
  per_page?: number,
) {
  if (!projectgroup) {
    console.log("No project-group specified")
    return { data: null }
  }

  return axios
    .get<MeilisearchResponse<AppsIndex>>(
      PROJECTGROUP_URL(projectgroup, page, per_page),
    )
    .catch((error) => {
      if (error.response.status === 404) {
        return {
          data: null,
        }
      }
    })
}

export async function fetchSearchQuery(
  query: string,
  selectedFilters: {
    filterType: string
    value: string
  }[],
) {
  const queryEncoded = encodeURIComponent(query).replace(/\./g, "%2E")
  return axios.post<MeilisearchResponseLimited<AppsIndex>>(
    SEARCH_APP,
    {
      query: queryEncoded,
      filters: selectedFilters,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  )
}

export async function fetchLoginProviders() {
  return axios.get<LoginProvider[]>(LOGIN_PROVIDERS_URL)
}

export async function fetchGithubRequestOrgAccessLink() {
  return axios.get<string>(REQUEST_ORG_ACCESS_LINK_GITHUB).catch((error) => {
    return {
      data: null,
    }
  })
}

export async function fetchVendingConfig() {
  return axios.get<VendingConfig | null>(VENDING_CONFIG_URL).catch((error) => {
    return {
      data: null,
    }
  })
}

export async function fetchVerificationStatus(appId: string) {
  return axios.get<VerificationStatus | undefined>(
    `${APP_VERIFICATION_STATUS(appId)}`,
  )
}

export async function fetchVerificationAvailableMethods(
  appId: string,
  isNewApp: boolean,
) {
  return axios.get<VerificationAvailableMethods | undefined>(
    `${APP_VERIFICATION_AVAILABLE_METHODS(appId, isNewApp ?? false)}`,
    { withCredentials: true },
  )
}

export async function fetchRuntimes() {
  return axios.get<{ [key: string]: number }>(RUNTIMES)
}
