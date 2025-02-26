import { AxiosResponse } from "axios"
import {
  ApplicationCard,
  ApplicationCardSkeleton,
} from "../application/ApplicationCard"
import { FunctionComponent } from "react"
import { mapAppsIndexToAppstreamListItemNew } from "src/meilisearch"
import { UseMutationResult } from "@tanstack/react-query"
import { MeilisearchResponseLimitedAppsIndex } from "src/codegen"

interface Props {
  results: UseMutationResult<
    AxiosResponse<MeilisearchResponseLimitedAppsIndex, any>,
    unknown
  >
}

export const SearchResults: FunctionComponent<Props> = ({ results }) => {
  return (
    <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
      {results.isPending &&
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
              application={mapAppsIndexToAppstreamListItemNew(app)}
            />
          </div>
        ))}
    </div>
  )
}
