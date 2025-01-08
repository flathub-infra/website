import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { SoftwareAppJsonLd, VideoGameJsonLd } from "next-seo"

import ApplicationDetails from "../../../src/components/application/Details"
import EolMessageDetails from "../../../src/components/application/EolMessage"
import {
  fetchAppstream,
  fetchAppStats,
  fetchSummary,
  fetchDeveloperApps,
  fetchAddons,
  fetchEolRebase,
  fetchVerificationStatus,
} from "../../../src/fetchers"
import { NextSeo } from "next-seo"
import {
  AddonAppstream,
  Appstream,
  pickScreenshotSize,
} from "../../../src/types/Appstream"
import { Summary } from "../../../src/types/Summary"
import { AppStats } from "../../../src/types/AppStats"
import { VerificationStatus } from "src/types/VerificationStatus"
import {
  AppsIndex,
  MeilisearchResponse,
  removeAppIdFromSearchResponse,
} from "src/meilisearch"
import { QualityModeration } from "src/components/application/QualityModeration"
import { useState } from "react"
import { useTranslation } from "next-i18next"
import { getKeywords, isValidAppId } from "@/lib/helpers"
import { calculateHumanReadableSize } from "src/size"
import { formatISO } from "date-fns"
import { UTCDate } from "@date-fns/utc"
import { bcpToPosixLocale } from "src/localize"
import { getEolMessageAppidEolMessageAppIdGet } from "src/codegen"

function categoryToSeoCategories(categories: string[]) {
  if (!categories) {
    return ""
  }

  return categories.map(categoryToSeoCategory).join(" ")
}

function categoryToSeoCategory(category) {
  switch (category) {
    case "AudioVideo":
      return "Multimedia"
    case "Development":
      return "Developer"
    case "Education":
      return "Educational"
    case "Game":
      return "Game"
    case "Graphics":
      return "Design"
    case "Network":
      return "SocialNetworking"
    case "Office":
      return "Business"
    case "Science":
      // Unsure what else we could map this to
      return "Educational"
    case "System":
      return "DesktopEnhancement"
    case "Utility":
      return "Utilities"
  }
}

export default function Details({
  app,
  summary,
  stats,
  developerApps,
  verificationStatus,
  eolMessage,
  addons,
  locale,
  datePublished,
}: {
  app: Appstream
  summary?: Summary
  stats: AppStats
  developerApps: MeilisearchResponse<AppsIndex>
  verificationStatus: VerificationStatus
  eolMessage: string
  addons: AddonAppstream[]
  locale: string
  datePublished: string
}) {
  const { t } = useTranslation()
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false)

  if (eolMessage) {
    return <EolMessageDetails message={eolMessage} />
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
      <NextSeo
        title={t("install-x", { "app-name": app?.name })}
        nofollow={app.type === "addon"}
        noindex={app.type === "addon"}
        description={app?.summary}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/${app?.id}`,
          images: [
            {
              url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/api/appOgImage/${app?.id}?locale=${locale}`,
              height: 628,
              width: 1200,
              alt: app?.name,
            },
          ],
        }}
      />
      {app.type !== "addon" && (
        <QualityModeration
          app={app}
          isQualityModalOpen={isQualityModalOpen}
          setIsQualityModalOpen={setIsQualityModalOpen}
        />
      )}
      <SoftwareAppJsonLd
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

export const getStaticProps: GetStaticProps = async ({
  locale,
  defaultLocale,
  params: { appId: appId },
}: {
  locale: string
  defaultLocale: string
  params: { appId: string }
}) => {
  console.log("Fetching data for app details: ", appId, locale)

  const isFlatpakref = (appId as string).endsWith(".flatpakref")

  appId = isFlatpakref
    ? appId.slice(0, appId.length - ".flatpakref".length)
    : appId

  if (!isValidAppId(appId as string)) {
    console.log("Not a valid app id: ", appId)
    return {
      notFound: true,
      revalidate: 60,
    }
  }

  const eolRebaseTo = await fetchEolRebase(appId as string)

  if (eolRebaseTo) {
    const prefix = locale && locale !== defaultLocale ? `/${locale}` : ``

    return {
      redirect: {
        destination: isFlatpakref
          ? `${prefix}/apps/${eolRebaseTo}.flatpakref`
          : `${prefix}/apps/${eolRebaseTo}`,
        permanent: true,
      },
    }
  }

  if (isFlatpakref) {
    return {
      redirect: {
        destination: `https://dl.flathub.org/repo/appstream/${appId}.flatpakref`,
        permanent: true,
      },
    }
  }

  let eolMessage: string | null = null
  const app = await fetchAppstream(appId as string, locale)

  if (!app) {
    eolMessage = (await getEolMessageAppidEolMessageAppIdGet(appId as string))
      .data
  }

  //@ts-ignore
  if ((!app && !eolMessage) || !!app?.detail?.[0]?.type) {
    return {
      notFound: true,
      revalidate: 60,
    }
  }

  const summary = await fetchSummary(appId as string)
  const stats = await fetchAppStats(appId as string)
  const developerApps =
    app && app.type !== "addon"
      ? await fetchDeveloperApps(app.developer_name, locale)
      : undefined
  const verificationStatus = await fetchVerificationStatus(appId as string)
  const addons = await fetchAddons(appId as string, locale)

  const datePublished = formatISO(new UTCDate(summary.timestamp * 1000))

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app,
      summary,
      stats,
      developerApps: removeAppIdFromSearchResponse(developerApps, app?.id),
      verificationStatus,
      eolMessage,
      addons,
      locale,
      datePublished,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
