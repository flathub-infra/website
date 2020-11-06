import { GetStaticProps } from 'next'
import Collection from '../../../src/components/application/Collection'
import { BASE_URI } from '../../../src/env'
import Application from '../../../src/types/Application'

const AllCategory = ({ applications }) => (
  <Collection title='All' applications={applications} />
)

export const getStaticProps: GetStaticProps = async () => {
  const res = await fetch(`${BASE_URI}/apps`)
  const applications: Application[] = await res.json()
  applications.sort((a, b) => a.name.localeCompare(b.name))

  return {
    props: {
      applications,
    },
  }
}

export default AllCategory
