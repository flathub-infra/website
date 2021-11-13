import { useMatomo } from '@datapunt/matomo-tracker-react'
import { GetServerSideProps } from 'next'
import { NextSeo } from 'next-seo'
import Collection from '../../../src/components/application/Collection'
import { fetchSearchQuery } from '../../../src/fetchers'
import { Appstream } from '../../../src/types/Appstream'

export default function Search({ applications, query }) {
  const { trackSiteSearch } = useMatomo()
  const trackSearch = () => {
    trackSiteSearch({
      keyword: query,
      count: applications.length,
    })
  }

  trackSearch()

  return (
    <>
      <NextSeo title={`Search for ${query}`} />

      <Collection title={`Search for '${query}'`} applications={applications} />
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const query = context.query.query as string
  const applications: Appstream[] = await fetchSearchQuery(query)

  return {
    props: {
      applications,
      query,
    },
  }
}
