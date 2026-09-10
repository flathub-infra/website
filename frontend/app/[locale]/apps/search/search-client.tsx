"use client"

import { useEffect, useState, useRef } from "react"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import { SearchPanel } from "../../../../src/components/search/SearchPanel"
import {
  getTrendingLastTwoWeeksCollectionTrendingGet,
  usePostSearchSearchPost,
} from "../../../../src/codegen"
import type { JSX } from "react"
import { useSearchParams } from "next/navigation"
import type {
  AppsIndex,
  MeilisearchResponseAppsIndex,
} from "../../../../src/codegen"
import { useLocale } from "next-intl"

const SearchClient = (): JSX.Element => {
  const { trackSiteSearch } = useMatomo()
  const searchParams = useSearchParams()
  const locale = useLocale()

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
  const [searchMetadataKey, setSearchMetadataKey] = useState<string | null>(
    null,
  )
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<AppsIndex[]>([])
  const [isRecommendationsLoading, setIsRecommendationsLoading] =
    useState(false)
  const [recommendationKey, setRecommendationKey] = useState<string | null>(
    null,
  )
  const searchRequestId = useRef(0)
  const searchKey = JSON.stringify([q, selectedFilters, locale])

  const search = usePostSearchSearchPost()

  const activeSearchMetadata =
    searchMetadataKey === searchKey ? searchMetadata : null
  const hasNextPage = activeSearchMetadata
    ? currentPage < activeSearchMetadata.totalPages
    : false

  const resetSearch = () => {
    setCurrentPage(1)
    setAllHits([])
    setSearchMetadata(null)
    setSearchMetadataKey(null)
    setIsLoadingMore(false)
    setIsInitialLoading(true)
    setRecommendations([])
    setIsRecommendationsLoading(false)
    setRecommendationKey(null)
  }

  const fetchNextPage = () => {
    if (hasNextPage && !search.isPending && !isLoadingMore) {
      setIsLoadingMore(true)
      const nextPage = currentPage + 1
      const requestId = searchRequestId.current

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
            if (requestId !== searchRequestId.current) {
              return
            }
            const { hits, ...metadata } = res.data
            setAllHits((prev) => [...prev, ...hits])
            setSearchMetadata(metadata)
            setSearchMetadataKey(searchKey)
            setCurrentPage(nextPage)
            setIsLoadingMore(false)
          },
          onError: () => {
            if (requestId !== searchRequestId.current) {
              return
            }
            setIsLoadingMore(false)
          },
        },
      )
    }
  }

  const performInitialSearch = (requestId: number) => {
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
          if (requestId !== searchRequestId.current) {
            return
          }
          if (q.length > 0) {
            trackSiteSearch({
              keyword: q,
              count: res.data.totalHits,
            })
          }

          const { hits, ...metadata } = res.data
          setAllHits(hits)
          setSearchMetadata(metadata)
          setSearchMetadataKey(searchKey)
          setCurrentPage(1)
          setIsInitialLoading(false)

          if (q.trim() && metadata.totalHits === 0) {
            setIsRecommendationsLoading(true)
            getTrendingLastTwoWeeksCollectionTrendingGet({
              page: 1,
              per_page: 6,
              locale,
            })
              .then((recommendationResponse) => {
                if (requestId !== searchRequestId.current) {
                  return
                }
                setRecommendations(recommendationResponse.data.hits)
                setRecommendationKey(searchKey)
                setIsRecommendationsLoading(false)
              })
              .catch(() => {
                if (requestId !== searchRequestId.current) {
                  return
                }
                setIsRecommendationsLoading(false)
              })
          }
        },
        onError: () => {
          if (requestId !== searchRequestId.current) {
            return
          }
          setIsInitialLoading(false)
        },
      },
    )
  }

  const retrySearch = () => {
    const requestId = ++searchRequestId.current
    resetSearch()
    performInitialSearch(requestId)
  }

  // Reset and perform initial search when query or filters change
  useEffect(() => {
    const requestId = ++searchRequestId.current
    resetSearch()
    performInitialSearch(requestId)
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, selectedFilters, locale])

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-6 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-3 md:flex-row">
        <SearchPanel
          searchResult={search}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
          query={q}
          allHits={searchMetadataKey === searchKey ? allHits : []}
          searchMetadata={activeSearchMetadata}
          hasNextPage={hasNextPage}
          isLoadingMore={isLoadingMore}
          isInitialLoading={isInitialLoading || searchMetadataKey !== searchKey}
          fetchNextPage={fetchNextPage}
          recommendations={
            recommendationKey === searchKey ? recommendations : []
          }
          isRecommendationsLoading={isRecommendationsLoading}
          clearFilters={() => setSelectedFilters([])}
          retrySearch={retrySearch}
        />
      </div>
    </div>
  )
}

export default SearchClient
