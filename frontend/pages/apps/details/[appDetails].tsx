import { GetStaticPaths, GetStaticProps } from 'next'

import ApplicationDetails from '../../../src/components/application/Details'
import Main from '../../../src/components/layout/Main'
import {
  fetchAppstream,
  fetchAppStats,
  fetchSummary,
  fetchDeveloperApps,
} from '../../../src/fetchers'
import { APPSTREAM_URL } from '../../../src/env'
import { NextSeo } from 'next-seo'
import {
  Appstream,
  pickScreenshot,
  Screenshot,
} from '../../../src/types/Appstream'
import { Summary } from '../../../src/types/Summary'
import { AppStats } from '../../../src/types/AppStats'

export default function Details({
  app,
  summary,
  stats,
  developerApps,
}: {
  app: Appstream
  summary?: Summary
  stats: AppStats
  developerApps: Appstream[]
}) {
  const screenshots = app.screenshots
    ? app.screenshots.filter(pickScreenshot).map((screenshot: Screenshot) => ({
      url: pickScreenshot(screenshot).url,
    }))
    : []

  return (
    <Main>
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
        developerApps={developerApps.filter(devApp => devApp.id !== app.id)}
      />
    </Main >
  )
}

export const getStaticProps: GetStaticProps = async ({
  params: { appDetails: appId },
}) => {
  console.log('Fetching data for app details: ', appId)
  const app = await fetchAppstream(appId as string)
  const summary = await fetchSummary(appId as string)
  const stats = await fetchAppStats(appId as string)
  const developerApps = await fetchDeveloperApps(app?.developer_name)

  return {
    props: {
      app,
      summary,
      stats,
      developerApps: developerApps ?? [],
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const apps = await fetch(APPSTREAM_URL)
  const appsData: string[] = await apps.json()
  const paths = appsData.map((app) => ({
    params: { appDetails: app },
  }))

  return {
    paths,
    fallback: false,
  }
}
