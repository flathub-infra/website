import { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'
import Router from 'next/router'
import { useEffect } from 'react'
import LoginProviders from '../../src/components/login/Providers'
import { useUserContext } from '../../src/context/user-info'
import { fetchLoginProviders } from '../../src/fetchers'
import { LoginProvider } from '../../src/types/Login'
import { useTranslation } from 'next-i18next'

export default function DeveloperLoginPortal({ providers }) {
  const { t } = useTranslation()
  const user = useUserContext()

  useEffect(() => {
    // Already logged in, just redirect to userpage
    if (user.info && !user.loading) {
      Router.push('/userpage')
    }
  }, [user])

  return (
    <>
      <NextSeo title={t('developer-login')} />
      <LoginProviders providers={providers} />
    </>
  )
}

// Providers won't change often so fetch at build time for now
export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const providers: LoginProvider[] = await fetchLoginProviders()

  // If request failed at build time, this page becomes a 404
  return {
    notFound: !providers,
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
      providers,
    },
  }
}
