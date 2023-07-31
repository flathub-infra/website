import { AppHeader } from "./AppHeader"
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import React from "react"
import { Appstream, mapScreenshot, pickScreenshot } from "../../types/Appstream"
import { useTranslation } from "next-i18next"

import { Summary } from "../../types/Summary"

import Releases from "./Releases"

import AdditionalInfo from "./AdditionalInfo"
import { AppStats } from "../../types/AppStats"
import AppStatistics from "./AppStats"
import { SoftwareAppJsonLd, VideoGameJsonLd } from "next-seo"
import ApplicationSection from "./ApplicationSection"
import { calculateHumanReadableSize } from "../../size"

import { useAsync } from "../../hooks/useAsync"
import { getAppVendingSetup } from "../../asyncs/vending"

import { useCollapse } from "@collapsed/react"
import { VerificationStatus } from "src/types/VerificationStatus"
import { clsx } from "clsx"
import {
  AppsIndex,
  MeilisearchResponse,
  mapAppsIndexToAppstreamListItem,
} from "src/meilisearch"
import Tags from "./Tags"
import "yet-another-react-lightbox/plugins/captions.css"
import { CarouselStrip } from "./CarouselStrip"

interface Props {
  app?: Appstream
  summary?: Summary
  stats: AppStats
  developerApps: MeilisearchResponse<AppsIndex>
  projectgroupApps: MeilisearchResponse<AppsIndex>
  verificationStatus: VerificationStatus
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
}) => {
  const { t } = useTranslation()

  const [scrollHeight, setScrollHeight] = useState(0)
  const collapsedHeight = 356
  const ref = useRef(null)

  useEffect(() => {
    setScrollHeight(ref.current.scrollHeight)
  }, [ref])

  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse({
    collapsedHeight: collapsedHeight,
  })

  const description = useMemo(
    () => (app.description ? app.description : ""),
    [app.description],
  )

  const { value: vendingSetup } = useAsync(
    useCallback(() => getAppVendingSetup(app.id), [app.id]),
  )

  if (app) {
    const stableReleases = app.releases?.filter(
      (release) => release.type === undefined || release.type === "stable",
    )

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
          <div>
            <h2 className="my-4 text-xl font-semibold ">{app.summary}</h2>
            {scrollHeight > collapsedHeight && (
              <div
                {...getCollapseProps({ ref })}
                className={clsx(
                  `prose relative transition-all dark:prose-invert xl:max-w-[75%]`,
                  !isExpanded &&
                    scrollHeight > collapsedHeight &&
                    "from-flathub-white before:absolute before:bottom-0 before:left-0 before:h-1/3 before:w-full before:bg-gradient-to-t before:content-[''] dark:from-flathub-dark-gunmetal",
                )}
                dangerouslySetInnerHTML={{
                  __html: description,
                }}
              />
            )}
            {scrollHeight <= collapsedHeight && (
              <div
                className={`prose dark:prose-invert xl:max-w-[75%]`}
                ref={ref}
                dangerouslySetInnerHTML={{
                  __html: description,
                }}
              />
            )}
          </div>
          {scrollHeight > collapsedHeight && (
            <button {...getToggleProps()}>
              <span className="m-0 w-full rounded-xl bg-flathub-white px-6 py-2 font-semibold shadow-md transition hover:cursor-pointer hover:bg-flathub-white dark:bg-flathub-arsenic/80 hover:dark:bg-flathub-arsenic">
                {isExpanded ? t(`show-less`) : t(`show-more`)}
              </span>
            </button>
          )}

          {stableReleases && stableReleases.length > 0 && (
            <Releases latestRelease={stableReleases[0]}></Releases>
          )}

          <AdditionalInfo
            data={app}
            summary={summary}
            appId={app.id}
            stats={stats}
          ></AdditionalInfo>

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

          <AppStatistics stats={stats}></AppStatistics>

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
