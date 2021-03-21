import { GetStaticProps } from 'next'
import Collection from '../../../src/components/application/Collection'
import Appstream from '../../../src/types/Appstream'

import { fetchApps } from '../../../src/fetchers';

const AllCategory = ({ applications }) => (
  <Collection title='All' applications={applications} />
)

export const getStaticProps: GetStaticProps = async () => {
  const applications: Appstream[] = await fetchApps()
  applications.sort((a, b) => a.name.localeCompare(b.name))

  return {
    props: {
      applications,
    },
  }
}

export default AllCategory
