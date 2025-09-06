"use client"

import { useEffect, useState } from "react"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import { SearchPanel } from "../../../../src/components/search/SearchPanel"
import { usePostSearchSearchPost } from "../../../../src/codegen"
import type { JSX } from "react"
import { useSearchParams } from "next/navigation"

interface SearchClientProps {
  locale?: string
}

const SearchClient = ({ locale }: SearchClientProps): JSX.Element => {
  const { trackSiteSearch } = useMatomo()
  const searchParams = useSearchParams()

  const q = searchParams.get("q") || ""

  const filtersFromQuery = []
  if (searchParams.get("runtime")) {
    filtersFromQuery.push({
      filterType: "runtime",
      value: searchParams.get("runtime") as string,
    })
  }

  if (searchParams.get("type")) {
    filtersFromQuery.push({
      filterType: "type",
      value: searchParams.get("type") as string,
    })
  }

  const [selectedFilters, setSelectedFilters] = useState<
    {
      filterType: string
      value: string
    }[]
  >(filtersFromQuery)

  const search = usePostSearchSearchPost()

  useEffect(() => {
    // Only trigger search if query or filters change, and not while loading
    if (!search.isPending) {
      search.mutate(
        {
          data: {
            query: q,
            filters: selectedFilters,
          },
          params: {
            locale: locale,
          },
        },
        {
          onSuccess: (res) => {
            if (q.length > 0) {
              trackSiteSearch({
                keyword: q,
                count: res.data.estimatedTotalHits,
              })
            }
            return res
          },
        },
      )
    }
  }, [q, selectedFilters, locale])

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-6 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-3 md:flex-row">
        <SearchPanel
          searchResult={search}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
          query={q}
        />
      </div>
    </div>
  )
}

export default SearchClient
