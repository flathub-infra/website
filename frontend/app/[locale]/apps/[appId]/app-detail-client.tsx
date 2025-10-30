"use client"

import { SoftwareAppJsonLd, VideoGameJsonLd } from "next-seo"
import { useState } from "react"
import { useTranslations } from "next-intl"
import ApplicationDetails from "../../../../src/components/application/Details"
import EolMessageDetails from "../../../../src/components/application/EolMessage"
import { QualityModeration } from "../../../../src/components/application/QualityModeration"
import { getKeywords } from "@/lib/helpers"
import { calculateHumanReadableSize } from "../../../../src/size"
import { bcpToPosixLocale } from "../../../../src/localize"
import { pickScreenshotSize } from "../../../../src/types/Appstream"
import type { JSX } from "react"
import type { Summary } from "../../../../src/types/Summary"
import type {
  AddonAppstream,
  GetAppstreamAppstreamAppIdGet200,
  GetVerificationStatusVerificationAppIdStatusGet200,
  MeilisearchResponseAppsIndex,
  StatsResultApp,
} from "../../../../src/codegen"

interface AppDetailClientProps {
  app: GetAppstreamAppstreamAppIdGet200 | null
  summary?: Summary | null
  stats: StatsResultApp | null
  developerApps: MeilisearchResponseAppsIndex | null
  verificationStatus: GetVerificationStatusVerificationAppIdStatusGet200 | null
  eolMessage: string
  addons: AddonAppstream[]
  locale: string
  datePublished: string
}

function categoryToSeoCategories(categories: string[]) {
  if (!categories) {
    return ""
  }
  return categories.map(categoryToSeoCategory).join(" ")
}

function categoryToSeoCategory(category: string) {
  switch (category) {
    case "AudioVideo":
      return "MultimediaApplication"
    case "Audio":
      return "MultimediaApplication"
    case "Video":
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
      return "EducationalApplication"
    case "System":
      return "UtilitiesApplication"
    case "Utility":
      return "UtilitiesApplication"
    default:
      return "Application"
  }
}

const AppDetailClient = ({
  app,
  summary,
  stats,
  developerApps,
  verificationStatus,
  eolMessage,
  addons,
  locale,
  datePublished,
}: AppDetailClientProps): JSX.Element => {
  const t = useTranslations()
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false)

  if (eolMessage) {
    return (
      <>
        {/* <meta name="robots" content="noindex" /> */}
        <EolMessageDetails message={eolMessage} />
      </>
    )
  }

  if (!app) {
    return null // This should not happen, but just in case
  }

  const keywords = getKeywords(app)

  const screenshot =
    app.type !== "addon" && app.screenshots?.length > 0
      ? pickScreenshotSize(app.screenshots[0])
      : undefined

  const lastStableVersion = app.releases?.filter(
    (release) => release.type === undefined || release.type === "stable",
  )?.[0]?.version

  return (
    <>
      {app.type !== "addon" && (
        <QualityModeration
          app={app}
          isQualityModalOpen={isQualityModalOpen}
          setIsQualityModalOpen={setIsQualityModalOpen}
        />
      )}
      <SoftwareAppJsonLd
        useAppDir={true}
        name={app.name}
        inLanguage={bcpToPosixLocale(locale)}
        author={{ name: app.developer_name, type: "Person" }}
        maintainer={{ name: app.developer_name, type: "Person" }}
        operatingSystem="linux"
        price="0"
        priceCurrency="USD"
        applicationCategory={categoryToSeoCategories(
          app.type === "addon" ? [] : app.categories,
        )}
        keywords={keywords.join(", ")}
        description={app.summary}
        fileSize={
          summary
            ? calculateHumanReadableSize(summary.download_size)
            : t("unknown")
        }
        datePublished={datePublished}
        screenshot={
          screenshot
            ? {
                type: "ImageObject",
                url: screenshot.src,
                caption: screenshot.caption,
                height: screenshot.height,
                width: screenshot.width,
              }
            : undefined
        }
        softwareVersion={lastStableVersion}
        storageRequirements={
          summary
            ? calculateHumanReadableSize(summary.installed_size)
            : t("unknown")
        }
      />
      {app.type !== "addon" && app.categories?.includes("Game") && (
        <VideoGameJsonLd
          useAppDir={true}
          name={app.name}
          inLanguage={bcpToPosixLocale(locale)}
          authorName={app.developer_name}
          maintainer={{ name: app.developer_name, type: "Person" }}
          operatingSystemName={"linux"}
          platformName={"linux"}
          applicationCategory={categoryToSeoCategories(app.categories)}
          keywords={keywords.join(", ")}
          description={app.summary}
          operatingSystem="linux"
          offers={{
            price: "0",
            priceCurrency: "USD",
          }}
          fileSize={
            summary
              ? calculateHumanReadableSize(summary.download_size)
              : t("unknown")
          }
          datePublished={datePublished}
          screenshot={
            screenshot
              ? {
                  type: "ImageObject",
                  url: screenshot.src,
                  caption: screenshot.caption,
                  height: screenshot.height,
                  width: screenshot.width,
                }
              : undefined
          }
          softwareVersion={lastStableVersion}
          storageRequirements={
            summary
              ? calculateHumanReadableSize(summary.installed_size)
              : t("unknown")
          }
        />
      )}
      <ApplicationDetails
        app={app}
        summary={summary}
        stats={stats}
        developerApps={developerApps}
        verificationStatus={verificationStatus}
        addons={addons}
        isQualityModalOpen={isQualityModalOpen}
        keywords={keywords}
      />
    </>
  )
}

export default AppDetailClient
