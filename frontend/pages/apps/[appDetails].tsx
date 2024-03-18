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
} from "../../src/fetchers"
import { NextSeo } from "next-seo"
import { AddonAppstream, DesktopAppstream } from "../../src/types/Appstream"
import { Summary } from "../../src/types/Summary"
import { AppStats } from "../../src/types/AppStats"
import {
  AppsIndex,
  MeilisearchResponse,
  removeAppIdFromSearchResponse,
} from "src/meilisearch"
import { QualityModeration } from "src/components/application/QualityModeration"
import { useState } from "react"
import { appApi, verificationApi } from "src/api"
import { VerificationStatus } from "src/codegen"
import { useTranslation } from "next-i18next"
import { isValidAppId } from "src/utils/helpers"

export default function Details({
  app,
  summary,
  stats,
  developerApps,
  verificationStatus,
  eolMessage,
  addons,
}: {
  app: DesktopAppstream
  summary?: Summary
  stats: AppStats
  developerApps: MeilisearchResponse<AppsIndex>
  verificationStatus: VerificationStatus
  eolMessage: string
  addons: AddonAppstream[]
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
              url: app?.icon,
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

  const { data: eolRebaseTo } = await appApi.getEolRebaseAppidEolRebaseAppIdGet(
    appId as string,
  )

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
  const app = await (await fetchAppstream(appId as string)).data

  if (!app) {
    eolMessage = (
      await appApi.getEolMessageAppidEolMessageAppIdGet(appId as string)
    ).data
  }

  if (!app && !eolMessage) {
    return {
      notFound: true,
    }
  }

  const { data: summary } = await fetchSummary(appId as string)
  const { data: stats } = await fetchAppStats(appId as string)
  const { data: developerApps } = await fetchDeveloperApps(app?.developer_name)
  const { data: verificationStatus } =
    await verificationApi.getVerificationStatusVerificationAppIdStatusGet(
      appId as string,
    )
  const addons = await fetchAddons(appId as string)

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
