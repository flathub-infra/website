import { GetStaticProps } from 'next'

import ApplicationCollection from '../../../src/components/application/Collection'
import fetchCollection from '../../../src/fetchers'
import Collections from '../../../src/types/Collection'
import Appstream from '../../../src/types/Appstream'
import { NextSeo } from 'next-seo'

export default function PopularApps({ applications }) {
  return (
    <>
      <NextSeo title='Popular Apps' />
      <ApplicationCollection title='Popular Apps' applications={applications} />
    </>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const applications: Appstream[] = await fetchCollection(Collections.popular)
  applications.sort((a, b) => a.name.localeCompare(b.name))

  return {
    props: {
      applications,
    },
  }
}
