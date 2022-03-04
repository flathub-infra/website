import { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import Main from '../src/components/layout/Main'

import fetchCollection from '../src/fetchers'
import { APPS_IN_PREVIEW_COUNT } from '../src/env'
import { NextSeo } from 'next-seo'
import { Collections } from '../src/types/Collection'
import ApplicationSections from '../src/components/application/Sections'
import Button from '../src/components/Button'
import { useTranslation } from 'next-i18next';

export default function Home({
  recentlyUpdated,
  editorsChoiceApps,
  editorsChoiceGames,
  popular,
}) {
  const { t } = useTranslation();
  return (
    <Main>
      <NextSeo
        title={t('home')}
        description={t('flathub-description')}
      />
      <div className='main-container'>
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
        <a href='https://flatpak.org/setup/'>
          <Button type='secondary'>{t('quick-setup')}</Button>
        </a>
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
