import { GetStaticProps } from 'next'
import { Collections } from '../../src/types/Collection'
import fetchCollection from '../../src/fetchers'
import Main from '../../src/components/layout/Main'
import { APPS_IN_PREVIEW_COUNT } from '../../src/env'
import { NextSeo } from 'next-seo'
import ApplicationSections from '../../src/components/application/Sections'
import Link from 'next/link'
import Tile from '../../src/components/Tile'
import { Category, categoryToName } from '../../src/types/Category'
import styles from './index.module.scss'

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
      <div className='main-container'>
        <header className={styles.header}>
          <h3>Categories</h3>
        </header>
        <div className={styles.flex}>
          {Object.keys(Category).map((category: Category) => (
            <Link
              key={category}
              href={`/apps/category/${encodeURIComponent(category)}`}
              passHref
            >
              <Tile>{categoryToName(category)}</Tile>
            </Link>
          ))}
        </div>
        <ApplicationSections
          popular={popular}
          recentlyUpdated={recentlyUpdated}
          editorsChoiceApps={editorsChoiceApps}
          editorsChoiceGames={editorsChoiceGames}
        ></ApplicationSections>
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
