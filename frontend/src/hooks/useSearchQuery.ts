import { useMatomo } from "@jonkoops/matomo-tracker-react"
import { useState, useEffect } from "react"

import { fetchSearchQuery } from "../fetchers"
import { AppsIndex, MeilisearchResponseLimited } from "src/meilisearch"

export function useSearchQuery(
  query: string,
  freeSoftwareOnly: boolean,
): MeilisearchResponseLimited<AppsIndex> {
  const { trackSiteSearch } = useMatomo()
  const [searchResult, setSearchResult] =
    useState<MeilisearchResponseLimited<AppsIndex> | null>(null)

  useEffect(() => {
    const callSearch = async () => {
      const applications = await fetchSearchQuery(query, freeSoftwareOnly)
      setSearchResult(applications)
      trackSiteSearch({
        keyword: query as string,
        count: applications.hits.length,
      })
    }

    if (query) {
      setSearchResult(null)
      callSearch()
    }
  }, [trackSiteSearch, query, freeSoftwareOnly])

  return searchResult
}
