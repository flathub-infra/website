import ApplicationCollection from '../../../components/application/Collection'
import { BASE_URI } from './../../../env'

export default function PopularApps() {
  return (
    <ApplicationCollection
      title='Popular'
      apiURI={`${BASE_URI}/apps/collection/recently-updated`}
    />
  )
}
