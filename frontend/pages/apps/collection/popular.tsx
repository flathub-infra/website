import { GetStaticProps } from 'next'
import Application from './../../../src/types/Application'

import ApplicationCollection from '../../../src/components/application/Collection'
import { BASE_URI } from '../../../src/env'

export default function PopularApps({ applications }) {
  return <ApplicationCollection title='Popular' applications={applications} />
}

export const getStaticProps: GetStaticProps = async () => {
  const res = await fetch(`${BASE_URI}/apps/collection/recently-updated`)
  const applications: Application[] = await res.json()
  return {
    props: {
      applications,
    },
  }
}
