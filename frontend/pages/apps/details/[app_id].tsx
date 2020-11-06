import { GetStaticPaths, GetStaticProps } from 'next'
import ApplicationDetails from '../../../src/components/application/Details'
import Main from '../../../src/components/layout/Main'
import { BASE_URI } from '../../../src/env'
import Application from '../../../src/types/Application'
import Appstream from '../../../src/types/Appstream'

export default function Details({ appstream }) {
  return (
    <Main>
      <ApplicationDetails appstream={appstream} />
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const res = await fetch(`${BASE_URI}/appstream/${String(params.app_id)}`)
  const appstream: Appstream = await res.json()

  return {
    props: {
      appstream,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const res = await fetch(`${BASE_URI}/apps`)
  const apps: Application[] = await res.json()

  const paths = apps.map((app) => ({
    params: {
      app_id: app.flatpakAppId,
    },
  }))

  return {
    paths,
    fallback: false,
  }
}
