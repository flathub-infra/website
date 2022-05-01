import { useMatomo } from "@datapunt/matomo-tracker-react"
import { useState, useEffect } from "react"

import { fetchSearchQuery } from "../fetchers"
import { DesktopAppstream } from "../types/Appstream"

export function useSearchQuery(query: string): DesktopAppstream[] {
  const { trackSiteSearch } = useMatomo()
  const [searchResult, setSearchResult] = useState<DesktopAppstream[] | null>(
    null,
  )

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
