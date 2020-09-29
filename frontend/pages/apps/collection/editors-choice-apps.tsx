import ApplicationCollection from '../../../components/application/Collection'
import { BASE_URI } from './../../../env'

export default function EditorChoiceApps() {
    return (
        <ApplicationCollection title="Editor's Choice Apps" apiURI={`${BASE_URI}/apps/collection/recently-updated`} />
    )
}
