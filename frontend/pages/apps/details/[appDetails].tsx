import { GetStaticPaths, GetStaticProps } from 'next'

import ApplicationDetails from '../../../src/components/application/Details'
import Main from '../../../src/components/layout/Main'
import { fetchEntry } from '../../../src/fetchers'
import { APPSTREAM_URL } from '../../../src/env'
import { NextSeo } from 'next-seo'

export default function Details({ data }) {
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
            ...data.screenshots.map((screenshot: string) => ({
              url: screenshot['752x423'],
            })),
          ],
        }}
      />
      <ApplicationDetails data={data} />
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({
  params: { appDetails },
}) => {
  console.log('Fetching data for app details: ', appDetails)
  const data = await fetchEntry(appDetails as string)

  return {
    props: {
      data,
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
