import { GetServerSideProps } from 'next'
import Collection from '../../../src/components/application/Collection'
import { BASE_URI } from '../../../src/env'
import Application from '../../../src/types/Application'

export default function Search({ applications }) {
  return <Collection title='Search' applications={applications} />
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const query = context.query.query

  const res = await fetch(`${BASE_URI}/apps/search/${String(query)}`)
  const applications: Application[] = await res.json()

  return {
    props: {
      applications,
    },
  }
}
