import Collection from '../../../components/application/Collection'
import { BASE_URI } from './../../../env'

const AllCategory = () => {
  return <Collection title='All' apiURI={`${BASE_URI}/apps`} />
}

export default AllCategory
