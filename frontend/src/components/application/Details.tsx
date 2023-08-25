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

import AdditionalInfo from "./AdditionalInfo"
import { AppStats } from "../../types/AppStats"
import AppStatistics from "./AppStats"
import { SoftwareAppJsonLd, VideoGameJsonLd } from "next-seo"
import ApplicationSection from "./ApplicationSection"
import { calculateHumanReadableSize } from "../../size"

import { getAppVendingSetup } from "../../asyncs/vending"

import { VerificationStatus } from "src/types/VerificationStatus"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import Tags from "./Tags"
import SafetyRating from "./SafetyRating"
import "yet-another-react-lightbox/plugins/captions.css"
import { CarouselStrip } from "./CarouselStrip"
import { useQuery } from "@tanstack/react-query"
import { IS_PRODUCTION } from "src/env"
import { Description } from "./Description"
import { useUserContext } from "src/context/user-info"
import { VerticalStackedListBox } from "./VerticalStackedListBox"
import Addons from "./Addons"
import Tabs, { Tab } from "../Tabs"

interface Props {
  app?: DesktopAppstream
  summary?: Summary
  stats: AppStats
  developerApps: MeilisearchResponse<AppsIndex>
  projectgroupApps: MeilisearchResponse<AppsIndex>
  verificationStatus: VerificationStatus
  addons: AddonAppstream[]
}

function categoryToSeoCategories(categories: string[]) {
  if (!categories) {
    return ""
  }

  return categories.map(categoryToSeoCategory).join(" ")
}

function categoryToSeoCategory(category) {
  switch (category) {
    case "AudioVideo":
      return "MultimediaApplication"
    case "Development":
      return "DeveloperApplication"
    case "Education":
      return "EducationalApplication"
    case "Game":
      return "GameApplication"
    case "Graphics":
      return "DesignApplication"
    case "Network":
      return "SocialNetworkingApplication"
    case "Office":
      return "BusinessApplication"
    case "Science":
      // Unsure what else we could map this to
      return "EducationalApplication"
    case "System":
      return "DesktopEnhancementApplication"
    case "Utility":
      return "UtilitiesApplication"
  }
}

const Details: FunctionComponent<Props> = ({
  app,
  summary,
  stats,
  developerApps,
  projectgroupApps,
  verificationStatus,
  addons,
}) => {
  const { t } = useTranslation()
  const user = useUserContext()

  const { data: vendingSetup } = useQuery({
    queryKey: ["verification", app.id],
    queryFn: async () => {
      return getAppVendingSetup(app.id)
    },
    enabled: !!app.id && !IS_PRODUCTION,
  })

  if (app) {
    const stableReleases = app.releases?.filter(
      (release) => release.type === undefined || release.type === "stable",
    )

    const isModerator = user.info?.["is-moderator"] ?? false

    const tabs: Tab[] = [
      {
        name: t("information"),
        content: (
          <AdditionalInfo
            data={app}
            summary={summary}
            appId={app.id}
            stats={stats}
          ></AdditionalInfo>
        ),
      },
    ]

    if (addons?.length > 0) {
      tabs.push({
        name: t("add-ons"),
        content: <Addons addons={addons}></Addons>,
        noPadding: true,
      })
    }

    // only show graph, if we have more then ten days of data
    if (Object.keys(stats.installs_per_day).length > 10) {
      tabs.push({
        name: t("statistics"),
        content: <AppStatistics stats={stats}></AppStatistics>,
        noPadding: true,
      })
    }

    return (
      <div className="grid grid-cols-details 2xl:grid-cols-details2xl">
        <SoftwareAppJsonLd
          name={app.name}
          price="0"
          priceCurrency=""
          operatingSystem="LINUX"
          applicationCategory={categoryToSeoCategories(app.categories)}
        />
        {app.categories?.includes("Game") && (
          <VideoGameJsonLd
            name={app.name}
            authorName={app.developer_name}
            operatingSystemName={"LINUX"}
            storageRequirements={
              summary
                ? calculateHumanReadableSize(summary.download_size)
                : t("unknown")
            }
          />
        )}
        <AppHeader
          app={app}
          vendingSetup={vendingSetup}
          verificationStatus={verificationStatus}
        />
        <CarouselStrip app={app} />
        <div className="col-start-2 flex flex-col gap-6">
          <Description app={app} />

          {stableReleases && stableReleases.length > 0 && (
            <Releases latestRelease={stableReleases[0]}></Releases>
          )}

          {(isModerator || !IS_PRODUCTION) && (
            <VerticalStackedListBox>
              <SafetyRating data={app} summary={summary} />
            </VerticalStackedListBox>
          )}

          <div>
            <Tabs tabs={tabs} />
          </div>

          {developerApps && developerApps.totalHits > 0 && (
            <ApplicationSection
              href={`/apps/collection/developer/${app.developer_name}`}
              title={t("other-apps-by-developer", {
                developer: app.developer_name,
              })}
              applications={developerApps.hits
                .slice(0, 6)
                .map(mapAppsIndexToAppstreamListItem)}
              showMore={developerApps.totalHits > 6}
            />
          )}

          {projectgroupApps && projectgroupApps.totalHits > 0 && (
            <ApplicationSection
              href={`/apps/collection/project-group/${app.project_group}`}
              title={t("other-apps-by-projectgroup", {
                projectgroup: app.project_group,
              })}
              applications={projectgroupApps.hits
                .slice(0, 6)
                .map(mapAppsIndexToAppstreamListItem)}
              showMore={projectgroupApps.totalHits > 6}
            />
          )}

          <Tags keywords={app.keywords} />
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
