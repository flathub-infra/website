import { GetServerSideProps } from 'next'
import { NextSeo } from 'next-seo'
import Collection from '../../../src/components/application/Collection'
import { fetchSearchQuery } from '../../../src/fetchers'
import { Appstream } from '../../../src/types/Appstream'

export default function Search({ applications }) {
  return (
    <>
      <NextSeo title='Search' />
      <Collection title='Search' applications={applications} />
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const query = context.query.query
  const applications: Appstream[] = await fetchSearchQuery(query as string)

  return {
    props: {
      applications,
    },
  }
}
