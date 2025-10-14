import { AxiosResponse } from "axios"
import {
  ApplicationCard,
  ApplicationCardSkeleton,
} from "../application/ApplicationCard"
import { FunctionComponent } from "react"
import { mapAppsIndexToAppstreamListItem } from "src/meilisearch"
import { UseMutationResult } from "@tanstack/react-query"
import { MeilisearchResponseAppsIndex, AppsIndex } from "src/codegen"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

interface Props {
  results: UseMutationResult<
    AxiosResponse<MeilisearchResponseAppsIndex, any>,
    unknown
  >
  allHits: AppsIndex[]
  hasNextPage: boolean
  isLoadingMore: boolean
  isInitialLoading: boolean
  fetchNextPage: () => void
}

export const SearchResults: FunctionComponent<Props> = ({
  results,
  allHits,
  hasNextPage,
  isLoadingMore,
  isInitialLoading,
  fetchNextPage,
}) => {
  const t = useTranslations()

  return (
    <>
      <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
        {/* Show skeletons during initial loading or when pending with no results */}
        {(isInitialLoading || (results.isPending && allHits.length === 0)) &&
          [...new Array(21)].map((a, i) => {
            return (
              <div key={i} className="flex flex-col gap-2">
                <ApplicationCardSkeleton />
              </div>
            )
          })}
        {/* Show actual results */}
        {allHits.length > 0 &&
          !isInitialLoading &&
          allHits.map((app) => (
            <div key={app.app_id} className="flex flex-col gap-2">
              <ApplicationCard
                application={mapAppsIndexToAppstreamListItem(app)}
              />
            </div>
          ))}

        {/* Loading more skeleton cards in grid layout */}
        {isLoadingMore &&
          [...new Array(6)].map((_, i) => (
            <div key={`loading-${i}`} className="flex flex-col gap-2">
              <ApplicationCardSkeleton />
            </div>
          ))}
      </div>

      {/* Load More Button */}
      {hasNextPage && (
        <div className="flex justify-center mt-8 mb-4">
          <Button
            onClick={fetchNextPage}
            disabled={isLoadingMore}
            variant="secondary"
            size="lg"
            className="min-w-32"
          >
            {isLoadingMore ? t("loading") : t("show-more")}
          </Button>
        </div>
      )}
    </>
  )
}
