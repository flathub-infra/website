import { useMatomo } from "@mitresthen/matomo-tracker-react"
import { useState, useEffect } from "react"

import { fetchSearchQuery } from "../fetchers"
import { AppsIndex, MeilisearchResponseLimited } from "src/meilisearch"

export function useSearchQuery(
  query: string,
  selectedFilters: {
    filterType: string
    value: string
  }[],
): MeilisearchResponseLimited<AppsIndex> {
  const { trackSiteSearch } = useMatomo()
  const [searchResult, setSearchResult] =
    useState<MeilisearchResponseLimited<AppsIndex> | null>(null)

  useEffect(() => {
    const callSearch = async () => {
      const applications = await fetchSearchQuery(query, selectedFilters)
      setSearchResult(applications)
      if (query) {
        trackSiteSearch({
          keyword: query as string,
          count: applications.hits.length,
        })
      }
    }
    if (query.length > 0 || query === "") {
      setSearchResult(null)
      callSearch()
    }
  }, [trackSiteSearch, query, selectedFilters])

  return searchResult
}
