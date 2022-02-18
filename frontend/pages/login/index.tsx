import { GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import Main from '../../src/components/layout/Main'
import Router from 'next/router'
import { useEffect } from 'react'
import LoginProviders from '../../src/components/login/Providers'
import { useUserContext } from '../../src/context/user-info'
import { fetchLoginProviders } from '../../src/fetchers'
import { LoginProvider } from '../../src/types/Login'

export default function DeveloperLoginPortal({ providers }) {
  const user = useUserContext()

  useEffect(() => {
    // Already logged in, just redirect to userpage
    if (user.info && !user.loading) {
      Router.push('/userpage')
    }
  }, [user])

  return (
    <Main>
      <NextSeo title='Developer Login' />
      <LoginProviders providers={providers}/>
    </Main>
  )
}

// Providers won't change often so fetch at build time for now
export const getStaticProps: GetStaticProps = async () => {
  const providers: LoginProvider[] = await fetchLoginProviders()

  // If request failed at build time, this page becomes a 404
  return {
    notFound: !providers,
    props: {
      providers,
    }
  }
}
