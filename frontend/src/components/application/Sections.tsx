import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"

import ApplicationSection from "./ApplicationSection"
import {
  MeilisearchResponse,
  AppsIndex,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"

interface Props {
  popular: MeilisearchResponse<AppsIndex>
  recentlyUpdated: MeilisearchResponse<AppsIndex>
  recentlyAdded: MeilisearchResponse<AppsIndex>
  verified: MeilisearchResponse<AppsIndex>
}

const ApplicationSections: FunctionComponent<Props> = ({
  popular,
  recentlyUpdated,
  recentlyAdded,
  verified,
}) => {
  const { t } = useTranslation()
  return (
    <div className="space-y-10">
      <ApplicationSection
        key="recently_added"
        title={t("recently-added-apps")}
        applications={recentlyAdded.hits.map(mapAppsIndexToAppstreamListItem)}
        href="/apps/collection/recently-added"
      />
      <ApplicationSection
        key="updated"
        title={t("recently-updated-apps")}
        applications={recentlyUpdated.hits.map(mapAppsIndexToAppstreamListItem)}
        href="/apps/collection/recently-updated"
      />
      <ApplicationSection
        key="verified"
        title={t("verified-apps")}
        applications={verified.hits.map(mapAppsIndexToAppstreamListItem)}
        href="/apps/collection/verified"
      />
      <ApplicationSection
        key="popular"
        title={t("popular-apps")}
        applications={popular.hits.map(mapAppsIndexToAppstreamListItem)}
        href="/apps/collection/popular"
      />
    </div>
  )
}

export default ApplicationSections
