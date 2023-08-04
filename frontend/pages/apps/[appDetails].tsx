import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import ApplicationDetails from "../../src/components/application/Details"
import EolMessageDetails from "../../src/components/application/EolMessage"
import {
  fetchAppstream,
  fetchAppStats,
  fetchSummary,
  fetchDeveloperApps,
  fetchProjectgroupApps,
  fetchVerificationStatus,
  fetchEolRebase,
  fetchEolMessage,
} from "../../src/fetchers"
import { NextSeo } from "next-seo"
import {
  Appstream,
  pickScreenshot,
  Screenshot,
} from "../../src/types/Appstream"
import { Summary } from "../../src/types/Summary"
import { AppStats } from "../../src/types/AppStats"
import { VerificationStatus } from "src/types/VerificationStatus"
import {
  AppsIndex,
  MeilisearchResponse,
  removeAppIdFromSearchResponse,
} from "src/meilisearch"

export default function Details({
  app,
  summary,
  stats,
  developerApps,
  projectgroupApps,
  verificationStatus,
  eolMessage,
}: {
  app: Appstream
  summary?: Summary
  stats: AppStats
  developerApps: MeilisearchResponse<AppsIndex>
  projectgroupApps: MeilisearchResponse<AppsIndex>
  verificationStatus: VerificationStatus
  eolMessage: string
}) {
  if (eolMessage) {
    return <EolMessageDetails message={eolMessage} />
  }

  const screenshots = app.screenshots
    ? app.screenshots
        .filter((screenshot) => pickScreenshot(screenshot))
        .map((screenshot: Screenshot) => {
          const pickedScreenshot = pickScreenshot(screenshot)
          return {
            url: pickedScreenshot.src,
            alt: pickedScreenshot.caption,
          }
        })
    : []

  return (
    <>
      <NextSeo
        title={app?.name}
        description={app?.summary}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/${app?.id}`,
          images: [
            ...screenshots,
            {
              url: app?.icon,
            },
          ],
        }}
      />
      <ApplicationDetails
        app={app}
        summary={summary}
        stats={stats}
        developerApps={developerApps}
        projectgroupApps={projectgroupApps}
        verificationStatus={verificationStatus}
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

  const { data: eolRebaseTo } = await fetchEolRebase(appId as string)

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
    eolMessage = (await fetchEolMessage(appId as string)).data
  }

  if (!app && !eolMessage) {
    return {
      notFound: true,
    }
  }

  const { data: summary } = await fetchSummary(appId as string)
  const { data: stats } = await fetchAppStats(appId as string)
  const { data: developerApps } = await fetchDeveloperApps(app?.developer_name)
  const { data: projectgroupApps } = await fetchProjectgroupApps(
    app?.project_group,
  )
  const { data: verificationStatus } = await fetchVerificationStatus(
    appId as string,
  )

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app,
      summary,
      stats,
      developerApps: removeAppIdFromSearchResponse(developerApps, app?.id),
      projectgroupApps: removeAppIdFromSearchResponse(
        projectgroupApps,
        app?.id,
      ),
      verificationStatus,
      eolMessage,
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
