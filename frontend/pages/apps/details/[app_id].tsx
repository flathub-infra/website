import { GetStaticPaths, GetStaticProps } from 'next'

import Main from '../../../src/components/layout/Main'
import ApplicationDetails from '../../../src/components/application/Details'
import Appstream from '../../../src/types/Appstream'
import { BASE_URI } from '../../../src/env'
import Application from '../../../src/types/Application'

export default function Details({ appstream }) {
  return (
    <Main>
      <ApplicationDetails appstream={appstream} />
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const res = await fetch(`${BASE_URI}/appstream/${params.app_id}`)
  const appstream: Appstream = await res.json()
  return {
    props: {
      appstream
    }
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const res = await fetch(`${BASE_URI}/apps`)
  const apps: Application[] = await res.json()

  const paths = apps.map((app) => ({
    params: {
      app_id: app.flatpakAppId
    }
  }))

  return {
    paths,
    fallback: false
  }
}
