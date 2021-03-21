import { GetStaticProps } from 'next'
import Head from 'next/head'
import CategoriesList from '../src/components/categories/List'
import Collections from '../src/types/Collection'
import ApplicationSection from '../src/components/application/Section'
import Main from '../src/components/layout/Main'

import fetchCollection from '../src/fetchers';

export default function Home({ recentlyUpdated, editorsChoiceApps, editorsChoiceGames, popular }) {
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
          key='editor_choice'
          title="Editor's Picks"
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
