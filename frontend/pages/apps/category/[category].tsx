import { GetStaticPaths, GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'

import Collection from '../../../src/components/application/Collection'
import { fetchCategory } from '../../../src/fetchers'
import Appstream from '../../../src/types/Appstream'
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
    case Category.Game:
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

  return (
    <>
      <NextSeo title={title} />
      <Collection title={title} applications={applications} />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const applications: Appstream[] = await fetchCategory(
    params.category as keyof typeof Category
  )

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
