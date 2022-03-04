import { GetStaticPaths, GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'

import Collection from '../../../src/components/application/Collection'
import Main from '../../../src/components/layout/Main';
import { fetchCategory } from '../../../src/fetchers'
import { Appstream } from '../../../src/types/Appstream'
import { Category, categoryToName } from '../../../src/types/Category'

const ApplicationCategory = ({ applications }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const category = router.query.category as Category
  let title = categoryToName(category, t)

  return (
    <Main>
      <NextSeo title={title} />
      <Collection title={title} applications={applications} />
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale, params }) => {
  const applications: Appstream[] = await fetchCategory(
    params.category as keyof typeof Category
  )

  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
      applications,
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  }
}


export default ApplicationCategory
