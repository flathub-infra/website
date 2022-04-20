import { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'

import Main from '../src/components/layout/Main'

import fetchCollection from '../src/fetchers'
import { APPS_IN_PREVIEW_COUNT } from '../src/env'
import { NextSeo } from 'next-seo'
import { Collections } from '../src/types/Collection'
import ApplicationSections from '../src/components/application/Sections'
import Button from '../src/components/Button'
import { useTranslation } from 'next-i18next'
import Link from 'next/link'
import Image from '../src/components/Image'
import styles from './index.module.scss'

export default function Home({
  recentlyUpdated,
  editorsChoiceApps,
  editorsChoiceGames,
  popular,
}) {
  const { t } = useTranslation()
  return (
    <Main>
      <NextSeo title={t('home')} description={t('flathub-description')} />
      <div className='main-container'>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1>{t('apps-for-linux-right-here')}</h1>
            <p
              className='introduction'
              style={{
                marginBottom: '40px',
                fontSize: '110%',
                fontWeight: 300,
                maxWidth: '700px',
              }}
            >
              {t('welcome-to-flathub-index-text')}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <a href='https://flatpak.org/setup/'>
                <Button type='secondary'>{t('quick-setup')}</Button>
              </a>
              <Link href='/apps' passHref>
                <Button type='secondary'>{t('explore')}</Button>
              </Link>
              <Link href='/donate' passHref>
                <Button type='secondary'>
                  {t('donate-to', { project: 'Flathub' })}
                </Button>
              </Link>
            </div>
          </div>
          <div className={styles.launchImage}>
            <Image
              width='400'
              height='300px'
              src='/assets/landing.svg'
              alt=''
            />
          </div>
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

export const getStaticProps: GetStaticProps = async ({ locale }) => {
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
      ...(await serverSideTranslations(locale, ['common'])),
      recentlyUpdated,
      editorsChoiceApps,
      editorsChoiceGames,
      popular,
    },
    revalidate: 3600,
  }
}
