"use client"

import { useTranslations } from "next-intl"
import ApplicationCollectionSuspense from "../../../../../../src/components/application/ApplicationCollectionSuspense"
import type { AppstreamListItem } from "src/types/Appstream"

interface Props {
  applications: AppstreamListItem[]
  page: number
  totalPages: number
  totalHits: number
}

export default function MobileCollectionClient({
  applications,
  page,
  totalPages,
  totalHits,
}: Props) {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-12 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <ApplicationCollectionSuspense
        title={t("mobile-apps")}
        applications={applications}
        page={page}
        totalPages={totalPages}
        totalHits={totalHits}
      />
    </div>
  )
}
