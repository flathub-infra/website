import { GetStaticProps } from 'next'
import Head from 'next/head'
import Collections from '../../src/types/Collection'
import fetchCollection from '../../src/fetchers'
import ApplicationSection from '../../src/components/application/Section'
import Main from '../../src/components/layout/Main'

export default function Apps({ recentlyUpdated, editorsChoiceApps, editorsChoiceGames, popular }) {
  return (
    <Main>
      <Head>
        <title>Flathub—An app store and build service for Linux</title>
      </Head>
      <div className='applications-collection'>
        <div className='collection'>
          <ApplicationSection
            key='updated'
            title='New & Updated Apps'
            applications={recentlyUpdated}
            href='/apps/collection/recently-updated'
          />

          <ApplicationSection
            key='popular'
            title='Popular Apps'
            applications={popular}
            href='/apps/collection/popular'
          />

          <ApplicationSection
            key='editor_choice'
            title="Editor's Choice Apps"
            applications={editorsChoiceApps}
            href='/apps/collection/editors-choice-apps'
          />

          <ApplicationSection
            key='editor_choice_games'
            title="Editor's Choice Games"
            applications={editorsChoiceGames}
            href='/apps/collection/editors-choice-games'
          />
        </div>
      </div>
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const recentlyUpdated = await fetchCollection(Collections.recenltyUpdated, 6)
  const editorsChoiceApps = await fetchCollection(Collections.editorsApps, 6)
  const editorsChoiceGames = await fetchCollection(Collections.editorsGames, 6)
  const popular = await fetchCollection(Collections.popular, 6)

  return {
    props: {
      recentlyUpdated,
      editorsChoiceApps,
      editorsChoiceGames,
      popular
    },
  }
}
