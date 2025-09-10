"use client"

import { useTranslations } from "next-intl"
import ApplicationCollectionSuspense from "../../../../../../src/components/application/ApplicationCollectionSuspense"
import { mapAppsIndexToAppstreamListItem } from "../../../../../../src/meilisearch"
import { MeilisearchResponseAppsIndex } from "../../../../../../src/codegen"

interface Props {
  applications: MeilisearchResponseAppsIndex
}

export default function RecentlyAddedCollectionClient({ applications }: Props) {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-12 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <ApplicationCollectionSuspense
        title={t("new-apps")}
        applications={applications.hits.map(mapAppsIndexToAppstreamListItem)}
        page={applications.page}
        totalPages={applications.totalPages}
      />
    </div>
  )
}
