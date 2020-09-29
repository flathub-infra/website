import Collection from '../../../src/components/application/Collection'
import { BASE_URI } from '../../../src/env'

const AllCategory = () => {
  return <Collection title='All' apiURI={`${BASE_URI}/apps`} />
}

export default AllCategory
