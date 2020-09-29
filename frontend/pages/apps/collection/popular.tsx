import ApplicationCollection from '../../../src/components/application/Collection'
import { BASE_URI } from '../../../src/env'

export default function PopularApps() {
  return (
    <ApplicationCollection
      title='Popular'
      apiURI={`${BASE_URI}/apps/collection/recently-updated`}
    />
  )
}
