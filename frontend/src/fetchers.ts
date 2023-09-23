import { Appstream } from "./types/Appstream"
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
  ADDONS_URL,
  QUALITY_MODERATION_APP,
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
import {
  QualityModeration,
  QualityModerationResponse,
} from "./types/QualityModeration"

export async function fetchAppstreamList() {
  return axios.get<string[]>(APPSTREAM_URL)
}

export async function fetchAppstream(appId: string) {
  return axios.get<Appstream>(`${APP_DETAILS(appId)}`).catch((error) => {
    return {
      data: null,
    }
  })
}

export async function fetchEolRebase(appId: string) {
  return axios
    .get<string | undefined>(`${EOL_REBASE_URL(appId, "stable")}`)
    .catch((error) => {
      if (error.response.status === 404) {
        return {
          data: undefined,
        }
      }
    })
}

export async function fetchEolMessage(appId: string) {
  return axios
    .get<string | undefined>(`${EOL_MESSAGE_URL(appId, "stable")}`)
    .catch((error) => {
      return {
        data: undefined,
      }
    })
}

export async function fetchSummary(appId: string) {
  return axios.get<Summary>(`${SUMMARY_DETAILS(appId)}`).catch((error) => {
    return {
      data: null,
    }
  })
}

export async function fetchStats() {
  return axios.get<Stats>(`${STATS}`).catch((error) => {
    return {
      data: null,
    }
  })
}

export async function fetchAppStats(appId: string) {
  return axios.get<AppStats>(`${STATS_DETAILS(appId)}`).catch((error) => {
    return {
      data: {
        id: appId,
        installs_per_day: {},
        installs_last_7_days: 0,
        installs_last_month: 0,
        installs_total: 0,
      },
    }
  })
}

export async function fetchCollectionPopularLastMonth(
  page: number,
  per_page: number,
) {
  return axios.get<MeilisearchResponse<AppsIndex>>(
    POPULAR_LAST_MONTH_URL(page, per_page),
  )
}

export async function fetchCollectionRecentlyUpdated(
  page: number,
  per_page: number,
) {
  return axios.get<MeilisearchResponse<AppsIndex>>(
    RECENTLY_UPDATED_URL(page, per_page),
  )
}

export async function fetchCollectionRecentlyAdded(
  page: number,
  per_page: number,
) {
  return axios.get<MeilisearchResponse<AppsIndex>>(
    RECENTLY_ADDED_URL(page, per_page),
  )
}
export async function fetchCollectionVerified(page: number, per_page: number) {
  return axios.get<MeilisearchResponse<AppsIndex>>(
    VERIFIED_APPS_URL(page, per_page),
  )
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
  return axios.post<MeilisearchResponseLimited<AppsIndex>>(
    SEARCH_APP,
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

export async function fetchLoginProviders() {
  return axios.get<LoginProvider[]>(LOGIN_PROVIDERS_URL)
}

export async function fetchGithubRequestOrgAccessLink() {
  return axios.get<{ link: string }>(REQUEST_ORG_ACCESS_LINK_GITHUB)
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

export async function fetchAddons(appid: string) {
  const addonList = await axios.get<string[]>(ADDONS_URL(appid))

  const addonAppstreams = await Promise.all(addonList.data.map(fetchAppstream))

  const addonAppStats = await Promise.all(addonList.data.map(fetchAppStats))

  const combined = addonAppstreams.map((item) => {
    return {
      id: item.data.id,
      appstream: item.data,
      stats: addonAppStats.find((stats) => stats.data.id === item.data.id)
        ?.data,
    }
  })

  console.log("\nAddons for ", appid, " fetched")

  combined.sort((a, b) => {
    return b.stats.installs_total - a.stats.installs_total
  })

  return combined.map((item) => item.appstream)
}

export async function fetchQualityModerationForApp(appid: string) {
  return axios.get<QualityModerationResponse>(
    `${QUALITY_MODERATION_APP(appid)}`,
    {
      withCredentials: true,
    },
  )
}

export async function postQualityModerationForApp(
  appid: string,
  guideline_id: string,
  passed: boolean,
) {
  return axios.post(
    `${QUALITY_MODERATION_APP(appid)}`,
    {
      guideline_id,
      passed,
    },
    {
      withCredentials: true,
    },
  )
}
