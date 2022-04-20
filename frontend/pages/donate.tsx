import { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'
import Main from '../src/components/layout/Main'
import LoginGuard from '../src/components/login/LoginGuard'
import DonationInput from '../src/components/payment/DonationInput'

export default function Donate() {
  const { t } = useTranslation()

  return (
    <Main>
      <NextSeo title={t('donate-to', { project: 'Flathub' })} />
      <div className='main-container'>
        <LoginGuard>
          <h2>{t('donate-to', { project: 'Flathub' })}</h2>
          <DonationInput org='org.flathub.Flathub' />
        </LoginGuard>
      </div>
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
    revalidate: 3600,
  }
}
