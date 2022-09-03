import { AppHeader } from "./AppHeader"
import { useMatomo } from "@jonkoops/matomo-tracker-react"
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import React from "react"
import { Carousel } from "react-responsive-carousel"
import { Appstream, pickScreenshot } from "../../types/Appstream"
import { useTranslation } from "next-i18next"

import { Summary } from "../../types/Summary"

import Releases from "./Releases"
import Button from "../Button"
import Image from "../Image"
import { MdChevronRight, MdChevronLeft, MdZoomIn } from "react-icons/md"
import CmdInstructions from "./CmdInstructions"
import AdditionalInfo from "./AdditionalInfo"
import { AppStats } from "../../types/AppStats"
import AppStatistics from "./AppStats"
import { SoftwareAppJsonLd, VideoGameJsonLd } from "next-seo"
import Lightbox from "react-image-lightbox"
import ApplicationSection from "./ApplicationSection"
import { calculateHumanReadableSize } from "../../size"
import { useUserContext } from "../../context/user-info"

import "react-image-lightbox/style.css" // This only needs to be imported once in your app
import { useAsync } from "../../hooks/useAsync"
import { getAppVendingSetup } from "../../asyncs/vending"

import useCollapse from "react-collapsed"

interface Props {
  app?: Appstream
  summary?: Summary
  stats: AppStats
  developerApps: Appstream[]
  projectgroupApps: Appstream[]
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
}) => {
  const { t } = useTranslation()
  const user = useUserContext()
  const [showLightbox, setShowLightbox] = useState(false)
  const [currentScreenshot, setCurrentScreenshot] = useState(0)
  const collapsedHeight = 172
  const ref = useRef(null)
  const [scrollHeight, setScrollHeight] = useState(0)
  useEffect(() => {
    setScrollHeight(ref.current.scrollHeight)
  }, [ref])
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse({
    collapsedHeight: collapsedHeight,
  })
  const { trackEvent } = useMatomo()

  const installClicked = (e) => {
    e.preventDefault()
    trackEvent({ category: "App", action: "Install", name: app.id })
    window.location.href = `https://dl.flathub.org/repo/appstream/${app.id}.flatpakref`
  }

  const donateClicked = (e) => {
    trackEvent({ category: "App", action: "Donate", name: app.id })
  }

  const description = useMemo(
    () => (app.description ? app.description : ""),
    [app.description],
  )

  const { value: vendingSetup } = useAsync(
    useCallback(() => getAppVendingSetup(app.id), [app.id]),
  )

  if (app) {
    const moreThan1Screenshot =
      app.screenshots?.filter(pickScreenshot).length > 1

    const stableReleases = app.releases.filter(
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
          user={user}
          installClicked={installClicked}
          donateClicked={donateClicked}
          vendingSetup={vendingSetup}
        />
        <div className="col-start-1 col-end-4 bg-bgColorSecondary">
          {showLightbox && (
            <Lightbox
              mainSrc={
                pickScreenshot(
                  app.screenshots?.filter(pickScreenshot)[currentScreenshot],
                ).url
              }
              onCloseRequest={() => setShowLightbox(false)}
            />
          )}
          <div className="max-w-11/12 relative mx-auto my-0 2xl:max-w-[1400px]">
            {app.screenshots && app.screenshots.length > 0 && (
              <Button
                className="!hover:text-gray-100 absolute right-3 bottom-3 z-10 h-12 w-12 rounded-xl border border-textSecondary bg-bgColorSecondary px-3 py-3 text-2xl !text-textSecondary hover:cursor-pointer hover:bg-colorPrimary"
                onClick={() => setShowLightbox(true)}
                aria-label={t("zoom")}
              >
                <MdZoomIn />
              </Button>
            )}
            <Carousel
              showThumbs={false}
              infiniteLoop={true}
              autoPlay={false}
              showArrows={true}
              showIndicators={moreThan1Screenshot}
              swipeable={true}
              emulateTouch={true}
              useKeyboardArrows={true}
              dynamicHeight={false}
              showStatus={false}
              onChange={(index) => {
                setCurrentScreenshot(index)
              }}
              renderArrowNext={(handler, hasNext, label) =>
                hasNext ? (
                  <div className="control-arrow control-next" onClick={handler}>
                    <MdChevronRight />
                  </div>
                ) : (
                  <></>
                )
              }
              renderArrowPrev={(handler, hasPrev, label) =>
                hasPrev ? (
                  <div className="control-arrow control-prev" onClick={handler}>
                    <MdChevronLeft />
                  </div>
                ) : (
                  <></>
                )
              }
            >
              {app.screenshots
                ?.filter(pickScreenshot)
                .map((screenshot, index) => {
                  const pickedScreenshot = pickScreenshot(screenshot)
                  return (
                    <Image
                      key={index}
                      src={pickedScreenshot.url}
                      width={752}
                      height={423}
                      alt={t("screenshot")}
                      loading="eager"
                      priority={index === 0}
                    />
                  )
                })}
            </Carousel>
          </div>
        </div>
        <div className="col-start-2 flex flex-col gap-6">
          <div>
            <h3 className="text-xl">{app.summary}</h3>
            {scrollHeight > collapsedHeight && (
              <div
                {...getCollapseProps()}
                className={`prose dark:prose-invert xl:max-w-[75%]`}
                ref={ref}
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
              <span className="m-0 w-full rounded-xl bg-bgColorSecondary py-2 px-6 font-semibold shadow-md hover:cursor-pointer hover:bg-colorHighlight">
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

          {developerApps && developerApps.length > 0 && (
            <ApplicationSection
              href={`/apps/collection/developer/${app.developer_name}`}
              title={t("other-apps-by-developer", {
                developer: app.developer_name,
              })}
              applications={developerApps.slice(0, 6)}
              showMore={developerApps.length > 6}
            />
          )}

          {projectgroupApps && projectgroupApps.length > 0 && (
            <ApplicationSection
              href={`/apps/collection/project-group/${app.project_group}`}
              title={t("other-apps-by-projectgroup", {
                projectgroup: app.project_group,
              })}
              applications={projectgroupApps.slice(0, 6)}
              showMore={projectgroupApps.length > 6}
            />
          )}

          <AppStatistics stats={stats}></AppStatistics>

          <CmdInstructions appId={app.id}></CmdInstructions>
        </div>
      </div>
    )
  } else {
    return (
      <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div>{t("loading")}</div>
      </div>
    )
  }
}

export default Details
