import { GetStaticPaths, GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'

import Collection from '../../../src/components/application/Collection'
import { fetchCategory } from '../../../src/fetchers'
import { Appstream } from '../../../src/types/Appstream'
import { Category, categoryToName } from '../../../src/types/Category'

const ApplicationCategory = ({ applications }) => {
  const router = useRouter()
  const category = router.query.category as Category
  let title = categoryToName(category)

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
