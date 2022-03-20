import Main from '../src/components/layout/Main'
import { FEED_NEW_URL, FEED_RECENTLY_UPDATED_URL } from '../src/env'
import { NextSeo } from 'next-seo'
import Button from '../src/components/Button'
import { Trans, useTranslation } from 'next-i18next'
import { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'

const Feeds = (): JSX.Element => {
  const { t } = useTranslation()
  return (
    <Main>
      <NextSeo title={t('rss-feeds')} description={t('rss-description')} />
      <div className='main-container' style={{ maxWidth: 600 }}>
        <h1>{t('rss-feeds')}</h1>
        <p>
          {t('rss-feeds-description')}
        </p>
        <h3>{t('new-apps')}</h3>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: '1rem',
          }}
        >
          <p>{t('new-apps-description')}</p>
          <a href={FEED_NEW_URL}>
            <Button>{t('subscribe')}</Button>
          </a>
        </div>
        <h3>{t("new-and-updated-apps")}</h3>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: '1rem',
          }}
        >
          <p>{t('new-and-updated-apps-description')}</p>
          <a href={FEED_RECENTLY_UPDATED_URL}>
            <Button>{t('subscribe')}</Button>
          </a>
        </div>

        <h6
          style={{
            marginTop: '0.5em !important',
            color: 'var(--text-secondary)',
          }}
        >
          <Trans i18nKey={"common:rss-applications"}>
            Do you need an RSS application? We have excellent ones in Flathub. Find
            them <a href='/apps/search/rss'>here</a>
          </Trans>
        </h6>
      </div>
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  }
}

export default Feeds
