import { GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import ApplicationCollection from '../../../src/components/application/Collection'
import Main from '../../../src/components/layout/Main'
import fetchCollection from '../../../src/fetchers'
import { Appstream } from '../../../src/types/Appstream'
import { Collections } from '../../../src/types/Collection'


export default function RecentlyUpdatedApps({ applications }) {
  return (
    <Main>
      <NextSeo title='Recently Updated Apps' />
      <ApplicationCollection
        title='Recently Updated Apps'
        applications={applications}
      />
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const applications: Appstream[] = await fetchCollection(
    Collections.recentlyUpdated
  )

  return {
    props: {
      applications,
    },
  }
}
