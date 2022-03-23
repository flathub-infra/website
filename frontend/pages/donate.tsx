import { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'
import Router from 'next/router'
import { useEffect } from 'react'
import Main from '../src/components/layout/Main'
import DonationInput from '../src/components/payment/DonationInput'
import { useUserContext } from '../src/context/user-info'

export default function Donate() {
  const { t } = useTranslation()
  const user = useUserContext()

  // Must be logged in to donate
  useEffect(() => {
    if (!user.info && !user.loading) {
      Router.push('/login')
    }
  }, [user])

  return (
    <Main>
      <NextSeo title={t('donate-to', { project: 'Flathub' })} />
      <div className='main-container'>
        <h2>{t('donate-to', { project: 'Flathub' })}</h2>
        <DonationInput org='org.flathub.Flathub' />
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
