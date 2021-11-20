import { GetStaticProps } from 'next'

import ApplicationCollection from '../../../src/components/application/Collection'
import fetchCollection from '../../../src/fetchers'
import { Collections } from '../../../src/types/Collection'
import { Appstream } from '../../../src/types/Appstream'
import { NextSeo } from 'next-seo'

export default function EditorChoiceGames({ applications }) {
  return (
    <>
      <NextSeo title="Editor's Choice Games" />
      <ApplicationCollection
        title="Editor's Choice Games"
        applications={applications}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const applications: Appstream[] = await fetchCollection(
    Collections.editorsGames
  )

  return {
    props: {
      applications,
    },
  }
}
