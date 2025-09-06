"use client"

import { useTranslations } from "next-intl"
import ApplicationCollection from "../../../../../../src/components/application/Collection"
import { mapAppsIndexToAppstreamListItem } from "../../../../../../src/meilisearch"
import { MeilisearchResponseAppsIndex } from "../../../../../../src/codegen"

interface Props {
  applications: MeilisearchResponseAppsIndex
}

export default function RecentlyUpdatedCollectionClient({
  applications,
}: Props) {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-12 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <ApplicationCollection
        title={t("updated-apps")}
        applications={applications.hits.map(mapAppsIndexToAppstreamListItem)}
        page={applications.page}
        totalPages={applications.totalPages}
      />
    </div>
  )
}
