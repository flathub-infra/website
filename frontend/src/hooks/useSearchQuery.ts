import { useMatomo } from "@jonkoops/matomo-tracker-react"
import { useState, useEffect } from "react"

import { fetchSearchQuery } from "../fetchers"
import { AppstreamListItem } from "../types/Appstream"
import { mapAppsIndexToAppstreamListItem } from "src/meilisearch"

export function useSearchQuery(
  query: string,
  freeSoftwareOnly: boolean,
): AppstreamListItem[] {
  const { trackSiteSearch } = useMatomo()
  const [searchResult, setSearchResult] = useState<AppstreamListItem[] | null>(
    null,
  )

  useEffect(() => {
    const callSearch = async () => {
      const applications = await fetchSearchQuery(query, freeSoftwareOnly)
      setSearchResult(applications.hits.map(mapAppsIndexToAppstreamListItem))
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
