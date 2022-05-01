import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

import ApplicationDetails from "../../../src/components/application/Details"
import {
  fetchAppstream,
  fetchAppStats,
  fetchSummary,
  fetchDeveloperApps,
  fetchAddons,
} from "../../../src/fetchers"
import { NextSeo } from "next-seo"
import {
  AddonAppstream,
  DesktopAppstream,
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
  addons,
}: {
  app: DesktopAppstream
  summary?: Summary
  stats: AppStats
  developerApps: DesktopAppstream[]
  addons: AddonAppstream[]
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
        addons={addons}
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
  const addons = await fetchAddons(appId as string)

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app,
      summary,
      stats,
      developerApps: developerApps ?? [],
      addons,
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
