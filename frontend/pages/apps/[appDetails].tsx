import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import ApplicationDetails from "../../src/components/application/Details"
import EolMessageDetails from "../../src/components/application/EolMessage"
import {
  fetchAppstream,
  fetchAppStats,
  fetchSummary,
  fetchDeveloperApps,
  fetchAddons,
  fetchEolRebase,
  fetchEolMessage,
  fetchVerificationStatus,
} from "../../src/fetchers"
import { NextSeo } from "next-seo"
import { AddonAppstream, DesktopAppstream } from "../../src/types/Appstream"
import { Summary } from "../../src/types/Summary"
import { AppStats } from "../../src/types/AppStats"
import { VerificationStatus } from "src/types/VerificationStatus"
import {
  AppsIndex,
  MeilisearchResponse,
  removeAppIdFromSearchResponse,
} from "src/meilisearch"
import { QualityModeration } from "src/components/application/QualityModeration"
import { useState } from "react"
import { useTranslation } from "next-i18next"
import { isValidAppId } from "@/lib/helpers"

export default function Details({
  app,
  summary,
  stats,
  developerApps,
  verificationStatus,
  eolMessage,
  addons,
  locale,
}: {
  app: DesktopAppstream
  summary?: Summary
  stats: AppStats
  developerApps: MeilisearchResponse<AppsIndex>
  verificationStatus: VerificationStatus
  eolMessage: string
  addons: AddonAppstream[]
  locale: string
}) {
  const { t } = useTranslation()
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false)

  if (eolMessage) {
    return <EolMessageDetails message={eolMessage} />
  }

  return (
    <>
      <NextSeo
        title={t("install-x", { "app-name": app?.name })}
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
      <QualityModeration
        app={app}
        isQualityModalOpen={isQualityModalOpen}
        setIsQualityModalOpen={setIsQualityModalOpen}
      />
      <ApplicationDetails
        app={app}
        summary={summary}
        stats={stats}
        developerApps={developerApps}
        verificationStatus={verificationStatus}
        addons={addons}
        isQualityModalOpen={isQualityModalOpen}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  defaultLocale,
  params: { appDetails: appId },
}) => {
  console.log("Fetching data for app details: ", appId)

  const isFlatpakref = (appId as string).endsWith(".flatpakref")

  appId = isFlatpakref
    ? appId.slice(0, appId.length - ".flatpakref".length)
    : appId

  if (!isValidAppId(appId as string)) {
    console.log("Not a valid app id: ", appId)
    return {
      notFound: true,
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

  let eolMessage: string = null
  const app = await fetchAppstream(appId as string, locale)

  if (!app) {
    eolMessage = await fetchEolMessage(appId as string)
  }

  if (!app && !eolMessage) {
    return {
      notFound: true,
    }
  }

  const summary = await fetchSummary(appId as string)
  const stats = await fetchAppStats(appId as string)
  const developerApps =
    app && app.type !== "addon"
      ? await fetchDeveloperApps(app.developer_name)
      : undefined
  const verificationStatus = await fetchVerificationStatus(appId as string)
  const addons = await fetchAddons(appId as string, locale)

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
