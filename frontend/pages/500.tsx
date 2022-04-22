import { GetStaticProps } from 'next'
import { Trans, useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

export default function Custom500() {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t('server-error')} />
      <div className='main-container'>
        <h1>{t('whoops')}</h1>
        <p>{t('an-error-occurred-server')}</p>
        <p>
          <Trans i18nKey={'common:retry-or-go-home'}>
            You might want to retry or go back <a href='.'>home</a>.
          </Trans>
        </p>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  }
}
