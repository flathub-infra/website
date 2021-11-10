import { GetStaticProps } from 'next'
import Link from 'next/link'

import ApplicationSection from '../src/components/application/Section'
import Main from '../src/components/layout/Main'

import fetchCollection from '../src/fetchers'
import { APPS_IN_PREVIEW_COUNT } from '../src/env'
import { NextSeo } from 'next-seo'
import { Collections } from '../src/types/Collection'

export default function Home({
  recentlyUpdated,
  editorsChoiceApps,
  editorsChoiceGames,
  popular,
}) {
  return (
    <Main>
      <NextSeo
        title='Home'
        description='Find and install hundreds of apps and games for Linux. Enjoy GIMP, GNU Octave, Spotify, Steam and many more!'
      />
      <div className='main-container'>
        <h1>Apps for Linux, right here</h1>
        <p className='introduction'>
          Welcome to Flathub, the home of hundreds of apps which can be easily
          installed on any Linux distribution. Browse the apps online, from your
          app center or the command line.
        </p>
        <div className='intro-links'>
          <a href='https://flatpak.org/setup/' className='primary-button'>
            Quick setup
          </a>
          <Link href='/apps' passHref>
            <div className='primary-button'>Browse the apps</div>
          </Link>
        </div>
        <ApplicationSection
          key='popular'
          title='Most Popular'
          applications={popular}
          href='/apps/collection/popular'
        />
        <ApplicationSection
          key='updated'
          title='Recently Updated'
          applications={recentlyUpdated}
          href='/apps/collection/recently-updated'
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
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const recentlyUpdated = await fetchCollection(
    Collections.recentlyUpdated,
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
