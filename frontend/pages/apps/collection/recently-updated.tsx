import ApplicationCollection from '../../../components/application/Collection'
import { BASE_URI } from './../../../env'

export default function RecentlyUpdatedApps() {
  return (
    <ApplicationCollection
      title='New & Updated Apps'
      apiURI={`${BASE_URI}/apps/collection/recently-updated`}
    />
  )
}
