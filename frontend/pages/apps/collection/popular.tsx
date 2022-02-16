import { GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import ApplicationCollection from '../../../src/components/application/Collection'
import Main from '../../../src/components/layout/Main'
import fetchCollection from '../../../src/fetchers'
import { Appstream } from '../../../src/types/Appstream'
import { Collections } from '../../../src/types/Collection'


export default function PopularApps({ applications }) {
  return (
    <Main>
      <NextSeo title='Popular Apps' />
      <ApplicationCollection title='Popular Apps' applications={applications} />
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const applications: Appstream[] = await fetchCollection(Collections.popular)

  return {
    props: {
      applications,
    },
  }
}
