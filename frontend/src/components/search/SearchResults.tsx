import { AxiosResponse } from "axios"
import {
  ApplicationCard,
  ApplicationCardSkeleton,
} from "../application/ApplicationCard"
import { FunctionComponent } from "react"
import {
  AppsIndex,
  mapAppsIndexToAppstreamListItem,
  MeilisearchResponseLimited,
} from "src/meilisearch"
import { UseQueryResult } from "@tanstack/react-query"

interface Props {
  results: UseQueryResult<
    AxiosResponse<MeilisearchResponseLimited<AppsIndex>, any>,
    unknown
  >
}

export const SearchResults: FunctionComponent<Props> = ({ results }) => {
  return (
    <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
      {results.isLoading &&
        [...new Array(20)].map((a, i) => {
          return (
            <div key={i} className={"flex flex-col gap-2"}>
              <ApplicationCardSkeleton />
            </div>
          )
        })}
      {results.isSuccess &&
        results.data?.data.hits.map((app) => (
          <div key={app.app_id} className={"flex flex-col gap-2"}>
            <ApplicationCard
              application={mapAppsIndexToAppstreamListItem(app)}
            />
          </div>
        ))}
    </div>
  )
}
