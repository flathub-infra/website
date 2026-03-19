import { isDesktopAppstreamTypeGuard } from "@/lib/helpers"
import { AppHeader } from "./AppHeader"
import { FunctionComponent } from "react"
import { useLocale, useTranslations } from "next-intl"

import { Summary } from "../../types/Summary"

import Releases from "./Releases"

import ApplicationSection from "./ApplicationSection"

import { mapAppsIndexToAppstreamListItem } from "src/meilisearch"
import Tags from "./Tags"
import "yet-another-react-lightbox/plugins/captions.css"
import { CarouselStrip } from "./CarouselStrip"
import { useQuery } from "@tanstack/react-query"
import { IS_PRODUCTION } from "src/env"
import { Description } from "./Description"
import Addons from "./Addons"
import SubHeader from "./sub-header"
import Links from "./Links"
import {
  AddonAppstream,
  GetAppstreamAppstreamAppIdGet200,
  getAppVendingSetupVendingappAppIdSetupGet,
  GetVerificationStatusVerificationAppIdStatusGet200,
  MeilisearchResponseAppsIndex,
  StatsResultApp,
} from "src/codegen"
import { getSafetyRating } from "src/safety"

interface Props {
  app?: GetAppstreamAppstreamAppIdGet200
  summary?: Summary
  stats: StatsResultApp | null
  developerApps: MeilisearchResponseAppsIndex
  verificationStatus: GetVerificationStatusVerificationAppIdStatusGet200
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
  const t = useTranslations()
  const locale = useLocale()

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

    const safetyRating =
      summary !== null && summary.metadata !== null
        ? getSafetyRating(app, summary.metadata)
        : []

    return (
      <div className="grid grid-cols-details 2xl:grid-cols-details2xl">
        <AppHeader
          app={app}
          vendingSetup={vendingSetup?.data}
          verificationStatus={verificationStatus}
          isQualityModalOpen={isQualityModalOpen}
        />
        <SubHeader
          app={app}
          summary={summary}
          stats={stats}
          safetyRating={safetyRating}
        />
        {isDesktopAppstreamTypeGuard(app) &&
          Array.isArray(app.screenshots) &&
          app.screenshots.length > 0 && <CarouselStrip app={app} />}
        <div className="col-start-2 flex flex-col gap-8 pt-2">
          {isDesktopAppstreamTypeGuard(app) && (
            <Description app={app} isQualityModalOpen={isQualityModalOpen} />
          )}

          {stableReleases && stableReleases.length > 0 && (
            <Releases latestRelease={stableReleases[0]} summary={summary} />
          )}

          {addons?.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">{t("add-ons")}</h2>
              <div className="rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic dark:shadow-none overflow-hidden">
                <Addons addons={addons} />
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-lg font-semibold">{t("links")}</h2>
            <div className="rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic dark:shadow-none overflow-hidden">
              <Links app={app} />
            </div>
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

          {/* Tags & Architectures */}
          {(summary?.arches?.length > 0 || keywords?.length > 0) && (
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pt-6 text-sm text-flathub-granite-gray dark:text-flathub-spanish-gray">
              <Tags keywords={keywords} />
              {summary?.arches?.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {t("available-architectures")}:
                  </span>
                  {summary.arches.map((arch) => (
                    <span
                      key={arch}
                      className="inline-flex items-center rounded-md bg-flathub-gainsborow/50 px-2 py-0.5 text-xs font-mono font-medium text-flathub-dark-gunmetal dark:bg-flathub-granite-gray/50 dark:text-flathub-gainsborow"
                    >
                      {arch}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
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
