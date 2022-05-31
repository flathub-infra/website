import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import ApplicationDetails from "../../../src/components/application/Details"
import {
  fetchAppstream,
  fetchAppStats,
  fetchSummary,
  fetchDeveloperApps,
  fetchProjectgroupApps,
} from "../../../src/fetchers"
import { APPSTREAM_URL } from "../../../src/env"
import { NextSeo } from "next-seo"
import {
  Appstream,
  pickScreenshot,
  Screenshot,
} from "../../../src/types/Appstream"
import { Summary } from "../../../src/types/Summary"
import { AppStats } from "../../../src/types/AppStats"

export default function Details({
  app,
  summary,
  stats,
  developerApps,
  projectgroupApps,
}: {
  app: Appstream
  summary?: Summary
  stats: AppStats
  developerApps: Appstream[]
  projectgroupApps: Appstream[]
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
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { appDetails: appId },
}) => {
  console.log("Fetching data for app details: ", appId)
  const app = await fetchAppstream(appId as string)
  const summary = await fetchSummary(appId as string)
  const stats = await fetchAppStats(appId as string)
  const developerApps = await fetchDeveloperApps(app?.developer_name)
  const projectgroupApps = await fetchProjectgroupApps(app?.project_group)

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app,
      summary,
      stats,
      developerApps: developerApps ?? [],
      projectgroupApps: projectgroupApps ?? [],
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
