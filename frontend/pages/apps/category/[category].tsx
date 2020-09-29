import Collection from '../../../components/application/Collection'
import Category from '../../../types/Category'
import { useRouter } from 'next/router'
import { BASE_URI } from './../../../env'

const ApplicationCategory = () => {
  const router = useRouter()
  const category = router.query.category as Category
  let title = ''
  switch (category) {
    case Category.AudioVideo:
      title = 'Audio & Video'
      break
    case Category.Development:
      title = 'Developer Tools'
      break
    case Category.Games:
      title = 'Games'
      break
    case Category.Graphics:
      title = 'Graphics & Photography'
      break
    case Category.Network:
      title = 'Communication & News'
      break
    case Category.Office:
      title = 'Productivity'
      break
    case Category.Utility:
      title = 'Utilities'
      break
    default:
      title = category as string
      break
  }
  return (
    <Collection
      title={title}
      apiURI={`${BASE_URI}/apps/category/${category}`}
    />
  )
}

export default ApplicationCategory
