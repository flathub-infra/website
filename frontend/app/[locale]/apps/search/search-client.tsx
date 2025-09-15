"use client"

import { useEffect, useState, useCallback } from "react"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import { SearchPanel } from "../../../../src/components/search/SearchPanel"
import { usePostSearchSearchPost } from "../../../../src/codegen"
import type { JSX } from "react"
import { useSearchParams } from "next/navigation"
import type {
  AppsIndex,
  MeilisearchResponseAppsIndex,
} from "../../../../src/codegen"

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

  // State for infinite scrolling
  const [currentPage, setCurrentPage] = useState(1)
  const [allHits, setAllHits] = useState<AppsIndex[]>([])
  const [searchMetadata, setSearchMetadata] = useState<Omit<
    MeilisearchResponseAppsIndex,
    "hits"
  > | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const search = usePostSearchSearchPost()

  const hasNextPage = searchMetadata
    ? currentPage < searchMetadata.totalPages
    : false

  const resetSearch = useCallback(() => {
    setCurrentPage(1)
    setAllHits([])
    setSearchMetadata(null)
    setIsLoadingMore(false)
  }, [])

  const fetchNextPage = useCallback(() => {
    if (hasNextPage && !search.isPending && !isLoadingMore) {
      setIsLoadingMore(true)
      const nextPage = currentPage + 1

      search.mutate(
        {
          data: {
            query: q,
            filters: selectedFilters,
            hits_per_page: 21,
            page: nextPage,
          },
          params: {
            locale: locale,
          },
        },
        {
          onSuccess: (res) => {
            const { hits, ...metadata } = res.data
            setAllHits((prev) => [...prev, ...hits])
            setSearchMetadata(metadata)
            setCurrentPage(nextPage)
            setIsLoadingMore(false)
          },
          onError: () => {
            setIsLoadingMore(false)
          },
        },
      )
    }
  }, [
    hasNextPage,
    search,
    isLoadingMore,
    currentPage,
    q,
    selectedFilters,
    locale,
  ])

  // Reset and perform initial search when query or filters change
  useEffect(() => {
    resetSearch()

    search.mutate(
      {
        data: {
          query: q,
          filters: selectedFilters,
          hits_per_page: 21,
          page: 1,
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
              count: res.data.totalHits,
            })
          }

          const { hits, ...metadata } = res.data
          setAllHits(hits)
          setSearchMetadata(metadata)
          setCurrentPage(1)
        },
      },
    )
  }, [q, selectedFilters, locale])

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-6 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-3 md:flex-row">
        <SearchPanel
          searchResult={search}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
          query={q}
          allHits={allHits}
          searchMetadata={searchMetadata}
          hasNextPage={hasNextPage}
          isLoadingMore={isLoadingMore}
          fetchNextPage={fetchNextPage}
        />
      </div>
    </div>
  )
}

export default SearchClient
