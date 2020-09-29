import ApplicationCollection from '../../../src/components/application/Collection'
import { BASE_URI } from '../../../src/env'

export default function EditorChoiceGames() {
  return (
    <ApplicationCollection
      title="Editor's Choice Games"
      apiURI={`${BASE_URI}/apps/collection/recently-updated`}
    />
  )
}
