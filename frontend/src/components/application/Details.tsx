import { AppHeader } from "./AppHeader"
import { FunctionComponent } from "react"
import React from "react"
import { AddonAppstream, Appstream } from "../../types/Appstream"
import { useLocale, useTranslations } from "next-intl"

import { Summary } from "../../types/Summary"

import Releases from "./Releases"

import AdditionalInfo from "./AdditionalInfo"
import AppStatistics from "./AppStats"

import ApplicationSection from "./ApplicationSection"

import { VerificationStatus } from "src/types/VerificationStatus"
import { mapAppsIndexToAppstreamListItem } from "src/meilisearch"
import Tags from "./Tags"
import SafetyRating from "./SafetyRating"
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
import {
  getAppVendingSetupVendingappAppIdSetupGet,
  MeilisearchResponseAppsIndex,
  StatsResultApp,
} from "src/codegen"
import { FlathubWorldMap } from "../../../app/[locale]/statistics/statistics-client"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { InformationCircleIcon } from "@heroicons/react/20/solid"
import clsx from "clsx"
import { UTCDate } from "@date-fns/utc"
import { getIntlLocale } from "src/localize"
import { getSafetyRating } from "src/safety"

interface Props {
  app?: Appstream
  summary?: Summary
  stats: StatsResultApp | null
  developerApps: MeilisearchResponseAppsIndex
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
  const t = useTranslations()
  const locale = useLocale()

  const i18n = getIntlLocale(locale)

  const countryStatisticsStartDate = new UTCDate(2024, 3, 15)

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
        content: (
          <AdditionalInfo summary={summary} stats={stats}></AdditionalInfo>
        ),
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
        content: <Addons addons={addons} />,
        replacePadding: "p-0",
      })
    }

    // only show graph, if we have more then ten days of data
    if (stats && Object.keys(stats.installs_per_day).length > 10) {
      tabs.push({
        name: t("statistics"),
        content: <AppStatistics stats={stats} />,
        replacePadding: "p-0",
      })
    }

    if (stats && stats.installs_per_country) {
      const countryData = Object.entries(stats.installs_per_country).map(
        ([key, value]) => {
          return {
            country: key,
            value: value,
          }
        },
      )
      if (countryData?.length > 0) {
        tabs.push({
          name: t("country-statistics"),
          content: (
            <div className="relative flex flex-col items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="absolute top-0 end-0 mt-1 me-1"
                      aria-label={t("since-x", {
                        date: countryStatisticsStartDate.toLocaleDateString(
                          getIntlLocale(i18n.language),
                        ),
                      })}
                    >
                      <InformationCircleIcon
                        className="size-5"
                        aria-label={t("since-x", {
                          date: countryStatisticsStartDate.toLocaleDateString(
                            getIntlLocale(i18n.language),
                          ),
                        })}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className={clsx("max-w-xs")}>
                    {t("since-x", {
                      date: countryStatisticsStartDate.toLocaleDateString(
                        getIntlLocale(i18n.language),
                      ),
                    })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <FlathubWorldMap country_data={countryData} refs={null} />
            </div>
          ),
          replacePadding: "p-0",
        })
      }
    }

    const children = [<LicenseInfo key={"license-info"} app={app} />]

    if (summary !== null && summary.metadata !== null) {
      const safetyRating = getSafetyRating(app, summary.metadata)
      if (safetyRating.length > 0) {
        children.unshift(
          <SafetyRating
            key={"safety-rating"}
            appName={app.name}
            safetyRating={safetyRating}
          />,
        )
      }
    }

    return (
      <div className="grid grid-cols-details 2xl:grid-cols-details2xl">
        <AppHeader
          app={app}
          vendingSetup={vendingSetup?.data}
          verificationStatus={verificationStatus}
          isQualityModalOpen={isQualityModalOpen}
        />
        {app.type !== "addon" && app.screenshots && <CarouselStrip app={app} />}
        <div className="col-start-2 flex flex-col gap-6">
          {app.type !== "addon" && (
            <Description app={app} isQualityModalOpen={isQualityModalOpen} />
          )}

          {stableReleases && stableReleases.length > 0 && (
            <Releases latestRelease={stableReleases[0]} summary={summary} />
          )}

          <HorizontalStackedListBox>{children}</HorizontalStackedListBox>

          <div>
            <Tabs tabs={tabs} tabsIdentifier={app.id} />
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
