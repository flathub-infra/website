import { GetStaticPaths, GetStaticProps } from 'next'
import { useRouter } from 'next/router'
import Collection from '../../../src/components/application/Collection'
import { BASE_URI } from '../../../src/env'
import Application from '../../../src/types/Application'
import Category from '../../../src/types/Category'

const ApplicationCategory = ({ applications }) => {
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
  }

  return <Collection title={title} applications={applications} />
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const res = await fetch(
    `${BASE_URI}/apps/category/${String(params.category)}`
  )
  const applications: Application[] = await res.json()

  return {
    props: {
      applications,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = Object.keys(Category).map((c) => ({
    params: {
      category: c,
    },
  }))

  return {
    paths,
    fallback: false,
  }
}

export default ApplicationCategory
