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
import { Carousel } from "react-responsive-carousel"
import { Appstream, mapScreenshot, pickScreenshot } from "../../types/Appstream"
import { useTranslation } from "next-i18next"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import Captions from "yet-another-react-lightbox/plugins/captions"

import { Summary } from "../../types/Summary"

import Releases from "./Releases"
import Button from "../Button"
import Image from "../Image"
import {
  HiChevronRight,
  HiChevronLeft,
  HiMagnifyingGlassPlus,
} from "react-icons/hi2"
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

const CarouselStrip = ({ app }: { app: Appstream }) => {
  const { t } = useTranslation()
  const [showLightbox, setShowLightbox] = useState(false)
  const [currentScreenshot, setCurrentScreenshot] = useState(0)

  useEffect(() => {
    setCurrentScreenshot(0)
  }, [app.id])

  const filteredScreenshots = app.screenshots?.filter((screenshot) =>
    pickScreenshot(screenshot),
  )

  return (
    <div className="col-start-1 col-end-4 bg-flathub-gainsborow dark:bg-flathub-arsenic">
      {filteredScreenshots && (
        <Lightbox
          controller={{ closeOnBackdropClick: true }}
          open={showLightbox}
          close={() => setShowLightbox(false)}
          plugins={[Zoom, Captions]}
          slides={app.screenshots?.map(mapScreenshot).map((screenshot) => {
            return {
              ...screenshot,
              title: screenshot.caption,
              caption: undefined,
            }
          })}
          index={currentScreenshot}
          render={{
            buttonPrev: app.screenshots.length <= 1 ? () => null : undefined,
            buttonNext: app.screenshots.length <= 1 ? () => null : undefined,
          }}
        />
      )}
      <div className="max-w-11/12 relative mx-auto my-0 2xl:max-w-[1400px]">
        {filteredScreenshots && filteredScreenshots?.length > 0 && (
          <Button
            className="absolute bottom-3 right-3 z-10 h-12 w-12 !bg-transparent px-3 py-3 text-2xl"
            onClick={() => setShowLightbox(true)}
            aria-label={t("zoom")}
            variant="secondary"
          >
            <HiMagnifyingGlassPlus />
          </Button>
        )}
        <Carousel
          className="w-full"
          showThumbs={false}
          infiniteLoop={true}
          autoPlay={false}
          showArrows={true}
          showIndicators={filteredScreenshots?.length > 1}
          swipeable={true}
          emulateTouch={true}
          useKeyboardArrows={true}
          dynamicHeight={false}
          showStatus={false}
          selectedItem={currentScreenshot}
          preventMovementUntilSwipeScrollTolerance={true}
          swipeScrollTolerance={30}
          onClickItem={() => setShowLightbox(true)}
          onChange={(index) => {
            setCurrentScreenshot(index)
          }}
          renderArrowNext={(handler, hasNext, label) =>
            hasNext ? (
              <div className="control-arrow control-next" onClick={handler}>
                <HiChevronRight />
              </div>
            ) : (
              <></>
            )
          }
          renderArrowPrev={(handler, hasPrev, label) =>
            hasPrev ? (
              <div className="control-arrow control-prev" onClick={handler}>
                <HiChevronLeft />
              </div>
            ) : (
              <></>
            )
          }
        >
          {filteredScreenshots?.map((screenshot, index) => {
            const pickedScreenshot = pickScreenshot(screenshot, 500)
            return (
              <figure
                key={index}
                className="flex h-full flex-col justify-center"
              >
                <div>
                  <Image
                    src={pickedScreenshot.src}
                    width={pickedScreenshot.width}
                    height={pickedScreenshot.height}
                    alt={pickedScreenshot.caption ?? t("screenshot")}
                    loading="eager"
                    priority={index === 0}
                  />
                </div>
                {pickedScreenshot.caption && (
                  <figcaption className="break-all">
                    {pickedScreenshot.caption}
                  </figcaption>
                )}
              </figure>
            )
          })}
        </Carousel>
      </div>
    </div>
  )
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
                  !isExpanded && scrollHeight > collapsedHeight
                    ? "from-transparent to-flathub-white before:absolute before:bottom-0 before:left-0 before:h-1/3 before:w-full before:bg-gradient-to-b before:content-[''] dark:to-flathub-dark-gunmetal"
                    : "",
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
