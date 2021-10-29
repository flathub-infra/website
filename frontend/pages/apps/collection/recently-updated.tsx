import { GetStaticProps } from 'next'

import ApplicationCollection from '../../../src/components/application/Collection'
import fetchCollection from '../../../src/fetchers'
import { Collections } from '../../../src/types/Collection'
import { Appstream } from '../../../src/types/Appstream'
import { NextSeo } from 'next-seo'

export default function RecentlyUpdatedApps({ applications }) {
  return (
    <>
      <NextSeo title='Recently Updated Apps' />
      <ApplicationCollection
        title='Recently Updated Apps'
        applications={applications}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const applications: Appstream[] = await fetchCollection(
    Collections.recentlyUpdated
  )
  applications.sort((a, b) => a.name.localeCompare(b.name))

  return {
    props: {
      applications,
    },
  }
}
