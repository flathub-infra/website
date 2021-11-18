import { GetStaticPaths, GetStaticProps } from 'next'

import ApplicationDetails from '../../../src/components/application/Details'
import Main from '../../../src/components/layout/Main'
import { fetchEntry, fetchStats, fetchSummary } from '../../../src/fetchers'
import { APPSTREAM_URL } from '../../../src/env'
import { NextSeo } from 'next-seo'
import { Appstream, Screenshot } from '../../../src/types/Appstream'
import { Summary } from '../../../src/types/Summary'
import { AppStats } from '../../../src/types/AppStats'

export default function Details({
  data,
  summary,
  stats,
}: {
  data: Appstream
  summary: Summary
  stats: AppStats
}) {
  const screenshots = data.screenshots
    ? data.screenshots.map((screenshot: Screenshot) => ({
        url: screenshot['752x423'],
      }))
    : []

  return (
    <Main>
      <NextSeo
        title={data.name}
        description={data.summary}
        openGraph={{
          images: [
            {
              url: data.icon,
            },
            ...screenshots,
          ],
        }}
      />
      <ApplicationDetails data={data} summary={summary} stats={stats} />
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({
  params: { appDetails },
}) => {
  console.log('Fetching data for app details: ', appDetails)
  const data = await fetchEntry(appDetails as string)
  const summary = await fetchSummary(appDetails as string)
  const stats = await fetchStats(appDetails as string)

  return {
    props: {
      data,
      summary,
      stats,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const apps = await fetch(APPSTREAM_URL)
  const appsData = await apps.json()
  const paths = appsData.map((app) => ({ params: { appDetails: app } }))

  return {
    paths,
    fallback: false,
  }
}
