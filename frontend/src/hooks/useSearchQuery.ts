import { useMatomo } from "@jonkoops/matomo-tracker-react"
import { useState, useEffect } from "react"

import { fetchSearchQuery } from "../fetchers"
import { Appstream } from "../types/Appstream"

export function useSearchQuery(query: string): Appstream[] {
  const { trackSiteSearch } = useMatomo()
  const [searchResult, setSearchResult] = useState<Appstream[] | null>(null)

  useEffect(() => {
    const callSearch = async () => {
      const applications = await fetchSearchQuery(query)
      setSearchResult(applications)
      trackSiteSearch({
        keyword: query as string,
        count: applications.length,
      })
    }

    if (query) {
      callSearch()
    }
  }, [trackSiteSearch, query])

  return searchResult
}
