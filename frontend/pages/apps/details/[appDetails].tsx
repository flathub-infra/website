import { GetStaticPaths, GetStaticProps } from 'next'
import ApplicationDetails from '../../../src/components/application/Details'
import Main from '../../../src/components/layout/Main'

import { fetchEntry } from '../../../src/fetchers'
import { APPSTREAM_URL } from '../../../src/env'

export default function Details({ data }) {
  return (
    <Main>
      <ApplicationDetails data={data} />
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({params: {appDetails}}) => {
  console.log("Fetching data for app details: ", appDetails)
  const data = await fetchEntry(appDetails as string)

  return {
    props: {
      data
    }
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const apps = await fetch(APPSTREAM_URL)
  const appsData = await apps.json()
  const paths = appsData.map(app => ({params: {appDetails: app}}))

  return {
    paths,
    fallback: false
  }
}
