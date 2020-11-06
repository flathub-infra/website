import Head from 'next/head'

import Main from './../src/components/layout/Main'
import ApplicationSection from './../src/components/application/Section'
import CategoriesList from '../src/components/categories/List'

import { BASE_URI } from '../src/env'
import { GetStaticProps } from 'next'
import Application from '../src/types/Application'

export default function Home({ recentlyUpdated }) {
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
          applications={recentlyUpdated}
          href='/apps/collection/editors-choice-apps'
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
          applications={recentlyUpdated}
          href='/apps/collection/popular'
        />
        <CategoriesList />
      </div>
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const res = await fetch(`${BASE_URI}/apps/collection/recently-updated/7`)
  const recentlyUpdated: Application[] = await res.json()
  return {
    props: {
      recentlyUpdated,
    },
  }
}
