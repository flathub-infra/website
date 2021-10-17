import { GetStaticProps } from 'next'
import Head from 'next/head'

import CategoriesList from '../src/components/categories/List'
import Collections from '../src/types/Collection'
import ApplicationSection from '../src/components/application/Section'
import Main from '../src/components/layout/Main'

import fetchCollection from '../src/fetchers'
import { APPS_IN_PREVIEW_COUNT } from '../src/env'

export default function Home({
  recentlyUpdated,
  editorsChoiceApps,
  editorsChoiceGames,
  popular,
}) {
  return (
    <Main>
      <Head>
        <title>Flathub—An app store and build service for Linux</title>
        <meta
          name='description'
          content='Find and install hundreds of apps and games for Linux. Enjoy GIMP, GNU Octave, Spotify, Steam and many more!'
        />
        <base href='/' />

        <link rel='icon' type='image/png' href='./favicon.png' />
      </Head>
      <div className='main-container'>
        <ApplicationSection
          key='editor_choice'
          title="Editor's Picks"
          applications={editorsChoiceApps}
          href='/apps/collection/editors-choice-apps'
        />
        <ApplicationSection
          key='editor_choice_games'
          title="Editor's Picks Games"
          applications={editorsChoiceGames}
          href='/apps/collection/editors-choice-games'
        />
        <ApplicationSection
          key='updated'
          title='Recently Updated'
          applications={recentlyUpdated}
          href='/apps/collection/recently-updated'
        />
        <ApplicationSection
          key='popular'
          title='Most Popular'
          applications={popular}
          href='/apps/collection/popular'
        />
        <CategoriesList />
      </div>
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const recentlyUpdated = await fetchCollection(
    Collections.recenltyUpdated,
    APPS_IN_PREVIEW_COUNT
  )
  const editorsChoiceApps = await fetchCollection(
    Collections.editorsApps,
    APPS_IN_PREVIEW_COUNT
  )
  const editorsChoiceGames = await fetchCollection(
    Collections.editorsGames,
    APPS_IN_PREVIEW_COUNT
  )
  const popular = await fetchCollection(
    Collections.popular,
    APPS_IN_PREVIEW_COUNT
  )

  return {
    props: {
      recentlyUpdated,
      editorsChoiceApps,
      editorsChoiceGames,
      popular,
    },
  }
}
