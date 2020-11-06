import { GetStaticProps } from 'next'
import Application from './../../../src/types/Application'

import ApplicationCollection from '../../../src/components/application/Collection'
import { BASE_URI } from '../../../src/env'

export default function EditorChoiceGames({ applications }) {
  return (
    <ApplicationCollection
      title="Editor's Choice Games"
      applications={applications}
    />
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const res = await fetch(`${BASE_URI}/apps/collection/recently-updated`)
  const applications: Application[] = await res.json()
  applications.sort((a, b) => a.name.localeCompare(b.name))
  return {
    props: {
      applications,
    },
  }
}
