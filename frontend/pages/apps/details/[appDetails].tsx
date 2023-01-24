import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import ApplicationDetails from "../../../src/components/application/Details"
import {
  fetchAppstream,
  fetchAppStats,
  fetchSummary,
  fetchDeveloperApps,
  fetchProjectgroupApps,
  fetchVerificationStatus,
  fetchEolRebase,
} from "../../../src/fetchers"
import { NextSeo } from "next-seo"
import {
  Appstream,
  pickScreenshot,
  Screenshot,
} from "../../../src/types/Appstream"
import { Summary } from "../../../src/types/Summary"
import { AppStats } from "../../../src/types/AppStats"
import { VerificationStatus } from "src/types/VerificationStatus"

export default function Details({
  app,
  summary,
  stats,
  developerApps,
  projectgroupApps,
  verificationStatus,
}: {
  app: Appstream
  summary?: Summary
  stats: AppStats
  developerApps: Appstream[]
  projectgroupApps: Appstream[]
  verificationStatus: VerificationStatus
}) {
  const screenshots = app.screenshots
    ? app.screenshots.filter(pickScreenshot).map((screenshot: Screenshot) => ({
        url: pickScreenshot(screenshot).url,
      }))
    : []

  return (
    <>
      <NextSeo
        title={app?.name}
        description={app?.summary}
        openGraph={{
          images: [
            {
              url: app?.icon,
            },
            ...screenshots,
          ],
        }}
      />
      <ApplicationDetails
        app={app}
        summary={summary}
        stats={stats}
        developerApps={developerApps.filter((devApp) => devApp.id !== app.id)}
        projectgroupApps={projectgroupApps.filter(
          (devApp) => devApp.id !== app.id,
        )}
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
  const eolRebaseTo = await fetchEolRebase(appId as string)

  if (eolRebaseTo) {
    return {
      redirect: {
        destination: `/apps/details/${eolRebaseTo}`,
        permanent: true,
      },
    }
  }
  const app = await fetchAppstream(appId as string)

  if (!app) {
    return {
      notFound: true,
    }
  }

  const summary = await fetchSummary(appId as string)
  const stats = await fetchAppStats(appId as string)
  const developerApps = await fetchDeveloperApps(app?.developer_name)
  const projectgroupApps = await fetchProjectgroupApps(app?.project_group)
  const verificationStatus = await fetchVerificationStatus(appId as string)

  return {
    props: {
      ...(await serverSideTranslations(locale ?? defaultLocale, ["common"])),
      app,
      summary,
      stats,
      developerApps: developerApps ?? [],
      projectgroupApps: projectgroupApps ?? [],
      verificationStatus,
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
