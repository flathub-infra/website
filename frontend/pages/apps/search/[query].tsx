import Collection from '../../../components/application/Collection'
import { useRouter } from 'next/router'
import {BASE_URI} from './../../../env'

export default function Search() {
    const router = useRouter()
    const query = router.query.query
    return (
        <Collection title="Search" apiURI={`${BASE_URI}/apps/search/${query}`} />
    )
}
