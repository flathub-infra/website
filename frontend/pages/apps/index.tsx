import { GetStaticProps } from 'next'
import { Collections } from '../../src/types/Collection'
import fetchCollection from '../../src/fetchers'
import ApplicationSection from '../../src/components/application/Section'
import Main from '../../src/components/layout/Main'
import { APPS_IN_PREVIEW_COUNT } from '../../src/env'
import { NextSeo } from 'next-seo'

export default function Apps({
  recentlyUpdated,
  editorsChoiceApps,
  editorsChoiceGames,
  popular,
}) {
  return (
    <Main>
      <NextSeo
        title='Applications'
        description='An app store and build service for Linux'
      />
      <div className='applications-collection main-container'>
        <div className='collection'>
          <ApplicationSection
            key='popular'
            title='Popular Apps'
            applications={popular}
            href='/apps/collection/popular'
          />
          <ApplicationSection
            key='updated'
            title='New & Updated Apps'
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
