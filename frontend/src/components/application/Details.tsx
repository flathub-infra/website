import { AppHeader } from "./AppHeader"
import { FunctionComponent } from "react"
import React from "react"
import {
  AddonAppstream,
  Appstream,
  DesktopAppstream,
} from "../../types/Appstream"
import { useTranslation } from "next-i18next"

import { Summary } from "../../types/Summary"

import Releases from "./Releases"

import SummaryInfo from "./AdditionalInfo"
import { AppStats } from "../../types/AppStats"
import AppStatistics from "./AppStats"

import ApplicationSection from "./ApplicationSection"

import { VerificationStatus } from "src/types/VerificationStatus"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import Tags from "./Tags"
import SafetyRating from "./SafetyRating"
import ContentRating from "./ContentRating"
import "yet-another-react-lightbox/plugins/captions.css"
import { CarouselStrip } from "./CarouselStrip"
import { useQuery } from "@tanstack/react-query"
import { IS_PRODUCTION } from "src/env"
import { Description } from "./Description"
import { HorizontalStackedListBox } from "./HorizontalStackedListBox"
import Addons from "./Addons"
import Tabs, { Tab } from "../Tabs"
import LicenseInfo from "./LicenseInfo"
import Links from "./Links"
import { getAppVendingSetupVendingappAppIdSetupGet } from "src/codegen"

interface Props {
  app?: Appstream
  summary?: Summary
  stats: AppStats
  developerApps: MeilisearchResponse<AppsIndex>
  verificationStatus: VerificationStatus
  addons: AddonAppstream[]
  isQualityModalOpen: boolean
  keywords: string[]
}

const Details: FunctionComponent<Props> = ({
  app,
  summary,
  stats,
  developerApps,
  verificationStatus,
  addons,
  isQualityModalOpen,
  keywords,
}) => {
  const { t } = useTranslation()

  const { data: vendingSetup } = useQuery({
    queryKey: ["appVendingSetup", app.id],
    queryFn: () => {
      return getAppVendingSetupVendingappAppIdSetupGet(app.id, {
        withCredentials: true,
      })
    },
    enabled: !!app.id && !IS_PRODUCTION,
  })

  if (app) {
    const stableReleases = app.releases?.filter(
      (release) => release.type === undefined || release.type === "stable",
    )

    const tabs: Tab[] = [
      {
        name: t("information"),
        content: <SummaryInfo summary={summary} stats={stats}></SummaryInfo>,
        replacePadding: "p-0 pb-3",
      },
      {
        name: t("links"),
        content: <Links app={app} />,
        replacePadding: "p-0",
      },
    ]

    if (addons?.length > 0) {
      tabs.push({
        name: t("add-ons"),
        content: <Addons addons={addons}></Addons>,
        replacePadding: "p-0",
      })
    }

    // only show graph, if we have more then ten days of data
    if (Object.keys(stats.installs_per_day).length > 10) {
      tabs.push({
        name: t("statistics"),
        content: <AppStatistics stats={stats}></AppStatistics>,
        replacePadding: "p-0",
      })
    }

    const children = [<LicenseInfo key={"license-info"} app={app} />]

    if (contentRating !== null) {
      children.unshift(
        <ContentRating key={"content-rating"} data={app} summary={summary} />,
      )
    }

    if (summary !== null && summary.metadata !== null) {
      children.unshift(
        <SafetyRating key={"safety-rating"} data={app} summary={summary} />,
      )
    }

    return (
      <div className="grid grid-cols-details 2xl:grid-cols-details2xl">
        <AppHeader
          app={app}
          vendingSetup={vendingSetup?.data}
          verificationStatus={verificationStatus}
          isQualityModalOpen={isQualityModalOpen}
        />
        <CarouselStrip app={app} />
        <div className="col-start-2 flex flex-col gap-6">
          <Description app={app} isQualityModalOpen={isQualityModalOpen} />

          {stableReleases && stableReleases.length > 0 && (
            <Releases latestRelease={stableReleases[0]} summary={summary} />
          )}

          <HorizontalStackedListBox>{children}</HorizontalStackedListBox>

          <div>
            <Tabs tabs={tabs} />
          </div>

          {developerApps && developerApps.totalHits > 0 && (
            <ApplicationSection
              type="withTitle"
              href={`/apps/collection/developer/${app.developer_name}`}
              title={t("other-apps-by-developer", {
                developer: app.developer_name,
              })}
              moreText={t("more-apps-by-developer", {
                developer: app.developer_name,
              })}
              applications={developerApps.hits
                .slice(0, 6)
                .map(mapAppsIndexToAppstreamListItem)}
              numberOfApps={developerApps.totalHits}
              showMore={developerApps.totalHits > 6}
            />
          )}

          <Tags keywords={keywords} />
        </div>
      </div>
    )
  } else {
    return (
      <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
        <div>{t("loading")}</div>
      </div>
    )
  }
}

export default Details
