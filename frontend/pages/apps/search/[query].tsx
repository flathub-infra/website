import { useRouter } from 'next/router'

import Collection from '../../../src/components/application/Collection'
import { BASE_URI } from '../../../src/env'

export default function Search() {
  const router = useRouter()
  const query = router.query.query
  return (
    <Collection title='Search' apiURI={`${BASE_URI}/apps/search/${query}`} />
  )
}
